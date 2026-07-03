"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortanaAiTrigger = void 0;
const crypto_1 = require("crypto");
const n8n_workflow_1 = require("n8n-workflow");
const DEFAULT_BASE_URL = 'https://app.agentkong.ai/api/v1';
/** Consumers SHOULD reject signatures older than 5 minutes (documented tolerance). */
const SIGNATURE_TOLERANCE_SECONDS = 300;
async function cortanaRequest(ctx, options) {
    var _a;
    const credentials = await ctx.getCredentials('cortanaAiApi');
    const baseUrl = (credentials.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    // Build the query string into the URL ourselves — n8n's request helper does
    // not reliably serialize the `qs` option across versions.
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries((_a = options.qs) !== null && _a !== void 0 ? _a : {})) {
        if (value !== undefined && value !== null && value !== '') {
            search.append(key, String(value));
        }
    }
    const qsString = search.toString();
    const url = `${baseUrl}${options.path}${qsString ? `?${qsString}` : ''}`;
    return (await ctx.helpers.request({
        method: options.method,
        url,
        headers: {
            Authorization: `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json',
        },
        ...(options.body ? { body: options.body } : {}),
        json: true,
    }));
}
/**
 * Verify X-Cortana-Signature: t=<unixts>,v1=HMAC-SHA256(secret, `${t}.${rawBody}`).
 */
function verifySignature(secret, header, rawBody) {
    const parts = new Map(header.split(',').map((part) => {
        var _a;
        const [key, ...rest] = part.split('=');
        return [(_a = key === null || key === void 0 ? void 0 : key.trim()) !== null && _a !== void 0 ? _a : '', rest.join('=')];
    }));
    const t = parts.get('t');
    const v1 = parts.get('v1');
    if (!t || !v1)
        return false;
    const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
    if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS)
        return false;
    const expected = (0, crypto_1.createHmac)('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
    if (expected.length !== v1.length)
        return false;
    try {
        return (0, crypto_1.timingSafeEqual)(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
    }
    catch {
        return false;
    }
}
class CortanaAiTrigger {
    constructor() {
        this.description = {
            displayName: 'Cortana AI Trigger',
            name: 'cortanaAiTrigger',
            icon: 'file:cortana-ai.svg',
            group: ['trigger'],
            version: 1,
            description: 'Starts the workflow when a new conversion or contact is recorded in Cortana',
            defaults: { name: 'Cortana AI Trigger' },
            inputs: [],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            credentials: [
                {
                    name: 'cortanaAiApi',
                    required: true,
                },
            ],
            webhooks: [
                {
                    name: 'default',
                    httpMethod: 'POST',
                    responseMode: 'onReceived',
                    path: 'webhook',
                },
            ],
            properties: [
                {
                    displayName: 'Business Name or ID',
                    name: 'businessId',
                    type: 'options',
                    required: true,
                    typeOptions: { loadOptionsMethod: 'getBusinesses' },
                    default: '',
                    description: 'The Cortana business to listen to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Events',
                    name: 'events',
                    type: 'multiOptions',
                    options: [
                        {
                            name: 'New Conversion',
                            value: 'conversion.created',
                            description: 'Triggers when a new conversion is recorded',
                        },
                        {
                            name: 'New Contact',
                            value: 'contact.created',
                            description: 'Triggers when a new contact is created',
                        },
                    ],
                    default: ['conversion.created'],
                    required: true,
                },
                {
                    displayName: 'Conversion Type Names or IDs',
                    name: 'conversionConfigIds',
                    type: 'multiOptions',
                    typeOptions: {
                        loadOptionsMethod: 'getConversionConfigs',
                        loadOptionsDependsOn: ['businessId'],
                    },
                    default: [],
                    description: 'Only trigger for these conversion types (leave empty for all). Applies to New Conversion events only. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Verify Signature',
                    name: 'verifySignature',
                    type: 'boolean',
                    default: true,
                    description: 'Whether to verify the X-Cortana-Signature header against the stored signing secret and ignore payloads that fail verification',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getBusinesses() {
                    var _a;
                    const response = await cortanaRequest(this, { method: 'GET', path: '/businesses' });
                    const businesses = (_a = response.data) !== null && _a !== void 0 ? _a : [];
                    return businesses.map((b) => ({
                        name: b.name || b.id,
                        value: b.id,
                    }));
                },
                async getConversionConfigs() {
                    var _a;
                    const businessId = this.getCurrentNodeParameter('businessId');
                    if (!businessId)
                        return [];
                    const response = await cortanaRequest(this, {
                        method: 'GET',
                        path: `/businesses/${businessId}/conversions/configs`,
                        qs: { limit: 100, isActive: 'true' },
                    });
                    const configs = (_a = response.data) !== null && _a !== void 0 ? _a : [];
                    return configs.map((c) => ({
                        name: c.displayName || c.name,
                        value: c.id,
                    }));
                },
            },
        };
        this.webhookMethods = {
            default: {
                async checkExists() {
                    const webhookData = this.getWorkflowStaticData('node');
                    if (!webhookData.subscriptionId)
                        return false;
                    // Heal server-side deletion: if the subscription is gone or inactive,
                    // report missing so n8n re-subscribes on activation.
                    try {
                        const businessId = this.getNodeParameter('businessId');
                        const response = await cortanaRequest(this, {
                            method: 'GET',
                            path: `/businesses/${businessId}/webhooks/${webhookData.subscriptionId}`,
                        });
                        const subscription = response.data;
                        if (!subscription || subscription.isActive === false) {
                            delete webhookData.subscriptionId;
                            delete webhookData.signingSecret;
                            return false;
                        }
                        return true;
                    }
                    catch {
                        delete webhookData.subscriptionId;
                        delete webhookData.signingSecret;
                        return false;
                    }
                },
                async create() {
                    var _a;
                    const businessId = this.getNodeParameter('businessId');
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const events = this.getNodeParameter('events');
                    const conversionConfigIds = this.getNodeParameter('conversionConfigIds', []);
                    const response = await cortanaRequest(this, {
                        method: 'POST',
                        path: `/businesses/${businessId}/webhooks`,
                        body: {
                            targetUrl: webhookUrl,
                            events,
                            ...(conversionConfigIds.length > 0 ? { conversionConfigIds } : {}),
                            description: `n8n trigger — ${(_a = this.getWorkflow().name) !== null && _a !== void 0 ? _a : 'workflow'}`,
                            // Explicit hint: self-hosted/tunneled n8n URLs defeat URL detection.
                            platform: 'n8n',
                        },
                    });
                    const data = response.data;
                    const webhookData = this.getWorkflowStaticData('node');
                    webhookData.subscriptionId = data.id;
                    // The ONLY time the secret is returned — persist it for verification.
                    webhookData.signingSecret = data.signingSecret;
                    return true;
                },
                async delete() {
                    const webhookData = this.getWorkflowStaticData('node');
                    if (!webhookData.subscriptionId)
                        return true;
                    const businessId = this.getNodeParameter('businessId');
                    try {
                        // Soft deactivate (the REST DELETE contract). Re-activation
                        // reactivates the same row server-side instead of piling up dead rows.
                        await cortanaRequest(this, {
                            method: 'DELETE',
                            path: `/businesses/${businessId}/webhooks/${webhookData.subscriptionId}`,
                        });
                    }
                    catch {
                        // Already deleted server-side — nothing to clean up.
                    }
                    delete webhookData.subscriptionId;
                    delete webhookData.signingSecret;
                    return true;
                },
            },
        };
    }
    async webhook() {
        var _a, _b;
        const bodyData = this.getBodyData();
        const verify = this.getNodeParameter('verifySignature', true);
        const webhookData = this.getWorkflowStaticData('node');
        const secret = webhookData.signingSecret;
        if (verify && secret) {
            const req = this.getRequestObject();
            const header = this.getHeaderData()['x-cortana-signature'];
            const rawBody = (_b = (_a = req.rawBody) === null || _a === void 0 ? void 0 : _a.toString('utf8')) !== null && _b !== void 0 ? _b : JSON.stringify(bodyData);
            if (!header || !verifySignature(secret, header, rawBody)) {
                // Log + ignore: respond 200 so the sender doesn't retry a payload we
                // deliberately rejected, but start no workflow run.
                console.warn('[CortanaAiTrigger] Ignored webhook with invalid signature');
                return { noWebhookResponse: false, workflowData: [] };
            }
        }
        return {
            workflowData: [this.helpers.returnJsonArray([bodyData])],
        };
    }
}
exports.CortanaAiTrigger = CortanaAiTrigger;
//# sourceMappingURL=CortanaAiTrigger.node.js.map
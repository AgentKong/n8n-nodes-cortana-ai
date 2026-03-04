"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortanaAiTrigger = void 0;
const BASE_URL = 'https://app.agentkong.ai/api/v1';
class CortanaAiTrigger {
    constructor() {
        this.description = {
            displayName: 'Cortana AI Trigger',
            name: 'cortanaAiTrigger',
            icon: 'file:cortana-ai.svg',
            group: ['trigger'],
            version: 1,
            description: 'Starts the workflow when a new conversion is recorded in Cortana AI',
            defaults: { name: 'Cortana AI Trigger' },
            inputs: [],
            outputs: ['main'],
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
                    displayName: 'Events',
                    name: 'events',
                    type: 'multiOptions',
                    options: [
                        {
                            name: 'Conversion Created',
                            value: 'conversion.created',
                            description: 'Triggers when any new conversion is recorded',
                        },
                    ],
                    default: ['conversion.created'],
                    required: true,
                },
                {
                    displayName: 'Filter by Conversion Source',
                    name: 'conversionSourceIds',
                    type: 'multiOptions',
                    typeOptions: {
                        loadOptionsMethod: 'getConversionSources',
                    },
                    default: [],
                    description: 'Only trigger when a conversion is recorded from these sources. Leave empty to trigger for all sources.',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getConversionSources() {
                    const credentials = await this.getCredentials('cortanaAiApi');
                    const response = await this.helpers.httpRequest({
                        method: 'GET',
                        url: `${BASE_URL}/conversion-sources`,
                        headers: {
                            Authorization: `Bearer ${credentials.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        qs: { businessId: credentials.businessId },
                    });
                    return response.data.map((source) => {
                        var _a, _b, _c, _d;
                        const configName = (_d = (_b = (_a = source.conversionConfig) === null || _a === void 0 ? void 0 : _a.displayName) !== null && _b !== void 0 ? _b : (_c = source.conversionConfig) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '';
                        return {
                            name: `${source.name}${configName ? ` (${configName})` : ''}`,
                            value: source.id,
                        };
                    });
                },
            },
        };
        this.webhookMethods = {
            default: {
                async checkExists() {
                    const webhookData = this.getWorkflowStaticData('node');
                    return !!webhookData.subscriptionId;
                },
                async create() {
                    const credentials = await this.getCredentials('cortanaAiApi');
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const events = this.getNodeParameter('events');
                    const conversionSourceIds = this.getNodeParameter('conversionSourceIds');
                    const body = {
                        businessId: credentials.businessId,
                        targetUrl: webhookUrl,
                        events,
                        platform: 'n8n',
                    };
                    // Only add filters if specific sources are selected
                    if (conversionSourceIds.length > 0) {
                        body.filters = { sourceIds: conversionSourceIds };
                    }
                    const response = await this.helpers.httpRequest({
                        method: 'POST',
                        url: `${BASE_URL}/webhooks/subscribe`,
                        headers: {
                            Authorization: `Bearer ${credentials.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body,
                    });
                    const webhookData = this.getWorkflowStaticData('node');
                    webhookData.subscriptionId = response.data
                        ? response.data.subscriptionId
                        : undefined;
                    webhookData.signingSecret = response.data
                        ? response.data.signingSecret
                        : undefined;
                    return true;
                },
                async delete() {
                    const credentials = await this.getCredentials('cortanaAiApi');
                    const webhookData = this.getWorkflowStaticData('node');
                    if (!webhookData.subscriptionId)
                        return true;
                    await this.helpers.httpRequest({
                        method: 'DELETE',
                        url: `${BASE_URL}/webhooks/unsubscribe`,
                        headers: {
                            Authorization: `Bearer ${credentials.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: {
                            businessId: credentials.businessId,
                            subscriptionId: webhookData.subscriptionId,
                        },
                    });
                    delete webhookData.subscriptionId;
                    delete webhookData.signingSecret;
                    return true;
                },
            },
        };
    }
    async webhook() {
        const bodyData = this.getBodyData();
        // Return the full payload for the workflow to use
        return {
            workflowData: [this.helpers.returnJsonArray([bodyData])],
        };
    }
}
exports.CortanaAiTrigger = CortanaAiTrigger;
//# sourceMappingURL=CortanaAiTrigger.node.js.map
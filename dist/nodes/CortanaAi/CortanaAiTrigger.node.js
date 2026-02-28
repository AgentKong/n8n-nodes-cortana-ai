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
            ],
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
                    const response = await this.helpers.httpRequest({
                        method: 'POST',
                        url: `${BASE_URL}/webhooks/subscribe`,
                        headers: {
                            Authorization: `Bearer ${credentials.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: {
                            businessId: credentials.businessId,
                            targetUrl: webhookUrl,
                            events,
                            platform: 'n8n',
                        },
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
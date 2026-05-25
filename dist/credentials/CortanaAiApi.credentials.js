"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortanaAiApi = void 0;
class CortanaAiApi {
    constructor() {
        this.name = 'cortanaAiApi';
        this.displayName = 'Cortana AI API';
        this.documentationUrl = 'httpsAppAgentkongAiDocsApi';
        this.icon = 'file:cortana-ai.svg';
        this.properties = [
            {
                displayName: 'API Key',
                name: 'apiKey',
                type: 'string',
                typeOptions: { password: true },
                default: '',
                required: true,
                description: 'Your Cortana AI API key (starts with ak_live_). Generate one in Business Settings → API & Webhooks.',
            },
            {
                displayName: 'Business ID',
                name: 'businessId',
                type: 'string',
                default: '',
                required: true,
                description: 'Your Cortana AI Business ID. Find it in the URL when viewing business settings.',
            },
        ];
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    Authorization: '=Bearer {{$credentials.apiKey}}',
                },
            },
        };
        this.test = {
            request: {
                baseURL: 'https://app.agentkong.ai',
                url: '/api/v1/conversion-types',
                method: 'GET',
                qs: {
                    businessId: '={{$credentials.businessId}}',
                },
            },
        };
    }
}
exports.CortanaAiApi = CortanaAiApi;
//# sourceMappingURL=CortanaAiApi.credentials.js.map
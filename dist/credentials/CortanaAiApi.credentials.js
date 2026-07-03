"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortanaAiApi = void 0;
/**
 * Cortana AI API credentials — v0.2 (scoped API).
 *
 * API key ONLY: one credential covers every business the key can reach; the
 * business is chosen per node instance (the businessId dropdown). Keys are
 * created at Control Center → Settings → API Keys with scopes:
 * contacts:read, contacts:write, conversions:read, conversions:write,
 * webhooks:read, webhooks:write.
 */
class CortanaAiApi {
    constructor() {
        this.name = 'cortanaAiApi';
        this.displayName = 'Cortana AI API';
        this.icon = 'file:cortana-ai.svg';
        this.documentationUrl = 'https://app.agentkong.ai/docs/api';
        this.properties = [
            {
                displayName: 'API Key',
                name: 'apiKey',
                type: 'string',
                typeOptions: { password: true },
                required: true,
                default: '',
                description: 'Your Cortana API key (sk-ak-…). Create one at Control Center → Settings → API Keys with the scopes: contacts:read, contacts:write, conversions:read, conversions:write, webhooks:read, webhooks:write. The key must have access to at least one business.',
            },
            {
                displayName: 'Base URL',
                name: 'baseUrl',
                type: 'string',
                default: 'https://app.agentkong.ai/api/v1',
                description: 'Leave as-is for Cortana cloud. Override only for local/staging testing (e.g. http://localhost:3000/api/v1).',
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
        // Any valid key passes here by design (the endpoint requires no specific
        // scope); missing webhooks:*/conversions:* scopes surface as readable
        // INSUFFICIENT_SCOPE errors at trigger activation / first action run.
        this.test = {
            request: {
                baseURL: '={{$credentials.baseUrl || "https://app.agentkong.ai/api/v1"}}',
                url: '/businesses',
                method: 'GET',
            },
        };
    }
}
exports.CortanaAiApi = CortanaAiApi;
//# sourceMappingURL=CortanaAiApi.credentials.js.map
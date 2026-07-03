import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
/**
 * Cortana AI API credentials — v0.2 (scoped API).
 *
 * API key ONLY: one credential covers every business the key can reach; the
 * business is chosen per node instance (the businessId dropdown). Keys are
 * created at Control Center → Settings → API Keys with scopes:
 * contacts:read, contacts:write, conversions:read, conversions:write,
 * webhooks:read, webhooks:write.
 */
export declare class CortanaAiApi implements ICredentialType {
    name: string;
    displayName: string;
    icon: "file:cortana-ai.svg";
    documentationUrl: string;
    properties: INodeProperties[];
    authenticate: IAuthenticateGeneric;
    test: ICredentialTestRequest;
}
//# sourceMappingURL=CortanaAiApi.credentials.d.ts.map
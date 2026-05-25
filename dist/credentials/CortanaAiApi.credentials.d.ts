import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
export declare class CortanaAiApi implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    icon: "file:cortana-ai.svg";
    properties: INodeProperties[];
    authenticate: IAuthenticateGeneric;
    test: ICredentialTestRequest;
}
//# sourceMappingURL=CortanaAiApi.credentials.d.ts.map
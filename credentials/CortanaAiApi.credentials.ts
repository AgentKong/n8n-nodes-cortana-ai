import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class CortanaAiApi implements ICredentialType {
  name = 'cortanaAiApi';
  displayName = 'Cortana AI API';
  documentationUrl = 'httpsAppAgentkongAiDocsApi';
  icon = 'file:cortana-ai.svg' as const;
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description:
        'Your Cortana AI API key (starts with ak_live_). Generate one in Business Settings → API & Webhooks.',
    },
    {
      displayName: 'Business ID',
      name: 'businessId',
      type: 'string',
      default: '',
      required: true,
      description:
        'Your Cortana AI Business ID. Find it in the URL when viewing business settings.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
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

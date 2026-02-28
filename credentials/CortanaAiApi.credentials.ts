import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class CortanaAiApi implements ICredentialType {
  name = 'cortanaAiApi';
  displayName = 'Cortana AI API';
  documentationUrl = 'https://app.agentkong.ai/docs/api';
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
}

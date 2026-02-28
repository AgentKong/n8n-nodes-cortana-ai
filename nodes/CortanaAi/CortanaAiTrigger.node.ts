import type {
  IHookFunctions,
  IWebhookFunctions,
  IDataObject,
  INodeType,
  INodeTypeDescription,
  IWebhookResponseData,
} from 'n8n-workflow';

const BASE_URL = 'https://app.agentkong.ai/api/v1';

export class CortanaAiTrigger implements INodeType {
  description: INodeTypeDescription = {
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

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        return !!webhookData.subscriptionId;
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const credentials = await this.getCredentials('cortanaAiApi');
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const events = this.getNodeParameter('events') as string[];

        const response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${BASE_URL}/webhooks/subscribe`,
          headers: {
            Authorization: `Bearer ${credentials.apiKey as string}`,
            'Content-Type': 'application/json',
          },
          body: {
            businessId: credentials.businessId as string,
            targetUrl: webhookUrl,
            events,
            platform: 'n8n',
          },
        });

        const webhookData = this.getWorkflowStaticData('node');
        webhookData.subscriptionId = (response as IDataObject).data
          ? ((response as IDataObject).data as IDataObject).subscriptionId
          : undefined;
        webhookData.signingSecret = (response as IDataObject).data
          ? ((response as IDataObject).data as IDataObject).signingSecret
          : undefined;

        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const credentials = await this.getCredentials('cortanaAiApi');
        const webhookData = this.getWorkflowStaticData('node');

        if (!webhookData.subscriptionId) return true;

        await this.helpers.httpRequest({
          method: 'DELETE',
          url: `${BASE_URL}/webhooks/unsubscribe`,
          headers: {
            Authorization: `Bearer ${credentials.apiKey as string}`,
            'Content-Type': 'application/json',
          },
          body: {
            businessId: credentials.businessId as string,
            subscriptionId: webhookData.subscriptionId as string,
          },
        });

        delete webhookData.subscriptionId;
        delete webhookData.signingSecret;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const bodyData = this.getBodyData() as IDataObject;

    // Return the full payload for the workflow to use
    return {
      workflowData: [this.helpers.returnJsonArray([bodyData])],
    };
  }
}

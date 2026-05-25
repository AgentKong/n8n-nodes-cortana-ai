import type {
  IHookFunctions,
  IWebhookFunctions,
  IDataObject,
  INodeType,
  INodeTypeDescription,
  IWebhookResponseData,
  ILoadOptionsFunctions,
  INodePropertyOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

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
    outputs: [NodeConnectionTypes.Main],
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
        description: 'Only trigger when a conversion is recorded from these sources. Leave empty to trigger for all sources. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
    ],
  };

  methods = {
    loadOptions: {
      async getConversionSources(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('cortanaAiApi');
        const response = (await this.helpers.httpRequestWithAuthentication.call(
          this,
          'cortanaAiApi',
          {
            method: 'GET',
            url: `${BASE_URL}/conversion-sources`,
            qs: { businessId: credentials.businessId as string },
          },
        )) as IDataObject;
        return (response.data as IDataObject[]).map((source: IDataObject) => {
          const configName =
            (source.conversionConfig as IDataObject)?.displayName ??
            (source.conversionConfig as IDataObject)?.name ??
            '';
          return {
            name: `${source.name as string}${configName ? ` (${configName})` : ''}`,
            value: source.id as string,
          };
        });
      },
    },
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
        const conversionSourceIds = this.getNodeParameter('conversionSourceIds') as string[];

        const body: IDataObject = {
          businessId: credentials.businessId as string,
          targetUrl: webhookUrl,
          events,
          platform: 'n8n',
        };

        // Only add filters if specific sources are selected
        if (conversionSourceIds.length > 0) {
          body.filters = { sourceIds: conversionSourceIds };
        }

        const response = (await this.helpers.httpRequestWithAuthentication.call(
          this,
          'cortanaAiApi',
          {
            method: 'POST',
            url: `${BASE_URL}/webhooks/subscribe`,
            body,
            json: true,
          },
        )) as IDataObject;

        const webhookData = this.getWorkflowStaticData('node');
        const data = response.data as IDataObject | undefined;
        webhookData.subscriptionId = data?.subscriptionId;
        webhookData.signingSecret = data?.signingSecret;

        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const credentials = await this.getCredentials('cortanaAiApi');
        const webhookData = this.getWorkflowStaticData('node');

        if (!webhookData.subscriptionId) return true;

        await this.helpers.httpRequestWithAuthentication.call(this, 'cortanaAiApi', {
          method: 'DELETE',
          url: `${BASE_URL}/webhooks/unsubscribe`,
          body: {
            businessId: credentials.businessId as string,
            subscriptionId: webhookData.subscriptionId as string,
          },
          json: true,
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

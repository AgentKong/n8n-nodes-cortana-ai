import { createHmac, timingSafeEqual } from 'crypto';
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

const DEFAULT_BASE_URL = 'https://app.usecortana.ai/api/v1';

/** Consumers SHOULD reject signatures older than 5 minutes (documented tolerance). */
const SIGNATURE_TOLERANCE_SECONDS = 300;

async function cortanaRequest(
  ctx: IHookFunctions | ILoadOptionsFunctions,
  options: {
    method: 'GET' | 'POST' | 'DELETE';
    path: string;
    body?: IDataObject;
    qs?: IDataObject;
  }
): Promise<IDataObject> {
  const credentials = await ctx.getCredentials('cortanaAiApi');
  const baseUrl = ((credentials.baseUrl as string) || DEFAULT_BASE_URL).replace(/\/+$/, '');
  // Build the query string into the URL ourselves — n8n's request helper does
  // not reliably serialize the `qs` option across versions.
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(options.qs ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, String(value));
    }
  }
  const qsString = search.toString();
  const url = `${baseUrl}${options.path}${qsString ? `?${qsString}` : ''}`;
  return (await ctx.helpers.request({
    method: options.method,
    url,
    headers: {
      Authorization: `Bearer ${credentials.apiKey as string}`,
      'Content-Type': 'application/json',
    },
    ...(options.body ? { body: options.body } : {}),
    json: true,
  })) as IDataObject;
}

/**
 * Verify X-Cortana-Signature: t=<unixts>,v1=HMAC-SHA256(secret, `${t}.${rawBody}`).
 */
function verifySignature(secret: string, header: string, rawBody: string): boolean {
  const parts = new Map(
    header.split(',').map((part) => {
      const [key, ...rest] = part.split('=');
      return [key?.trim() ?? '', rest.join('=')] as const;
    })
  );
  const t = parts.get('t');
  const v1 = parts.get('v1');
  if (!t || !v1) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  if (expected.length !== v1.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false;
  }
}

export class CortanaAiTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Cortana AI Trigger',
    name: 'cortanaAiTrigger',
    icon: 'file:cortana-ai.svg',
    group: ['trigger'],
    version: 1,
    description:
      'Starts the workflow when a new conversion or contact is recorded in Cortana',
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
        displayName: 'Business Name or ID',
        name: 'businessId',
        type: 'options',
        required: true,
        typeOptions: { loadOptionsMethod: 'getBusinesses' },
        default: '',
        description:
          'The Cortana business to listen to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        options: [
          {
            name: 'New Conversion',
            value: 'conversion.created',
            description: 'Triggers when a new conversion is recorded',
          },
          {
            name: 'New Contact',
            value: 'contact.created',
            description: 'Triggers when a new contact is created',
          },
        ],
        default: ['conversion.created'],
        required: true,
      },
      {
        displayName: 'Conversion Type Names or IDs',
        name: 'conversionConfigIds',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getConversionConfigs',
          loadOptionsDependsOn: ['businessId'],
        },
        default: [],
        description:
          'Only trigger for these conversion types (leave empty for all). Applies to New Conversion events only. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Verify Signature',
        name: 'verifySignature',
        type: 'boolean',
        default: true,
        description:
          'Whether to verify the X-Cortana-Signature header against the stored signing secret and ignore payloads that fail verification',
      },
    ],
  };

  methods = {
    loadOptions: {
      async getBusinesses(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const response = await cortanaRequest(this, { method: 'GET', path: '/businesses' });
        const businesses = (response.data as IDataObject[]) ?? [];
        return businesses.map((b) => ({
          name: (b.name as string) || (b.id as string),
          value: b.id as string,
        }));
      },

      async getConversionConfigs(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const businessId = this.getCurrentNodeParameter('businessId') as string;
        if (!businessId) return [];
        const response = await cortanaRequest(this, {
          method: 'GET',
          path: `/businesses/${businessId}/conversions/configs`,
          qs: { limit: 100, isActive: 'true' },
        });
        const configs = (response.data as IDataObject[]) ?? [];
        return configs.map((c) => ({
          name: (c.displayName as string) || (c.name as string),
          value: c.id as string,
        }));
      },
    },
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        if (!webhookData.subscriptionId) return false;

        // Heal server-side deletion: if the subscription is gone or inactive,
        // report missing so n8n re-subscribes on activation.
        try {
          const businessId = this.getNodeParameter('businessId') as string;
          const response = await cortanaRequest(this, {
            method: 'GET',
            path: `/businesses/${businessId}/webhooks/${webhookData.subscriptionId as string}`,
          });
          const subscription = response.data as IDataObject | undefined;
          if (!subscription || subscription.isActive === false) {
            delete webhookData.subscriptionId;
            delete webhookData.signingSecret;
            return false;
          }
          return true;
        } catch {
          delete webhookData.subscriptionId;
          delete webhookData.signingSecret;
          return false;
        }
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const businessId = this.getNodeParameter('businessId') as string;
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const events = this.getNodeParameter('events') as string[];
        const conversionConfigIds = this.getNodeParameter('conversionConfigIds', []) as string[];

        const response = await cortanaRequest(this, {
          method: 'POST',
          path: `/businesses/${businessId}/webhooks`,
          body: {
            targetUrl: webhookUrl,
            events,
            ...(conversionConfigIds.length > 0 ? { conversionConfigIds } : {}),
            description: `n8n trigger — ${this.getWorkflow().name ?? 'workflow'}`,
            // Explicit hint: self-hosted/tunneled n8n URLs defeat URL detection.
            platform: 'n8n',
          },
        });

        const data = response.data as IDataObject;
        const webhookData = this.getWorkflowStaticData('node');
        webhookData.subscriptionId = data.id;
        // The ONLY time the secret is returned — persist it for verification.
        webhookData.signingSecret = data.signingSecret;
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        if (!webhookData.subscriptionId) return true;

        const businessId = this.getNodeParameter('businessId') as string;
        try {
          // Soft deactivate (the REST DELETE contract). Re-activation
          // reactivates the same row server-side instead of piling up dead rows.
          await cortanaRequest(this, {
            method: 'DELETE',
            path: `/businesses/${businessId}/webhooks/${webhookData.subscriptionId as string}`,
          });
        } catch {
          // Already deleted server-side — nothing to clean up.
        }

        delete webhookData.subscriptionId;
        delete webhookData.signingSecret;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const bodyData = this.getBodyData() as IDataObject;
    const verify = this.getNodeParameter('verifySignature', true) as boolean;
    const webhookData = this.getWorkflowStaticData('node');
    const secret = webhookData.signingSecret as string | undefined;

    if (verify && secret) {
      const req = this.getRequestObject();
      const header = (this.getHeaderData() as IDataObject)['x-cortana-signature'] as
        | string
        | undefined;
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody?.toString('utf8')
        ?? JSON.stringify(bodyData);

      if (!header || !verifySignature(secret, header, rawBody)) {
        // Ignore silently: respond 200 so the sender doesn't retry a payload we
        // deliberately rejected, but start no workflow run.
        return { noWebhookResponse: false, workflowData: [] };
      }
    }

    return {
      workflowData: [this.helpers.returnJsonArray([bodyData])],
    };
  }
}

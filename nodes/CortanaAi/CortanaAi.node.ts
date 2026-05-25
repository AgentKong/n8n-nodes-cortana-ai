import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestOptions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const BASE_URL = 'https://app.agentkong.ai/api/v1';

// Hard upper bound on how many pages we will follow when "Return All" is enabled,
// so a runaway dataset cannot hang the workflow forever.
const MAX_PAGES = 100;
const PAGE_SIZE = 100;

// Keys in fieldMappings that are internal config, not actual source→target field mappings
const MAPPING_SKIP_KEYS = new Set([
  'config', 'webhookId', 'webhookTopic', 'pageTokens', 'ghlEventType', 'ghlLocationId',
  'formId', 'typeformFormId', 'whopConnectionId',
]);

async function cortanaRequest(
  context: IExecuteFunctions | ILoadOptionsFunctions,
  options: IHttpRequestOptions,
): Promise<unknown> {
  return context.helpers.httpRequestWithAuthentication.call(context, 'cortanaAiApi', options);
}

export class CortanaAi implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Cortana AI',
    name: 'cortanaAi',
    icon: 'file:cortana-ai.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Create conversions and manage data in Cortana AI',
    defaults: { name: 'Cortana AI' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'cortanaAiApi',
        required: true,
      },
    ],
    properties: [
      // ─── Resource ───────────────────────────────────────────────────────────
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Contact', value: 'contact' },
          { name: 'Conversion', value: 'conversion' },
          { name: 'Conversion Type', value: 'conversionType' },
        ],
        default: 'conversion',
      },

      // ─── Conversion Operations ───────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['conversion'] } },
        options: [
          {
            name: 'Create',
            value: 'create',
            action: 'Create a conversion',
            description: 'Record a new conversion entry in Cortana AI',
          },
          {
            name: 'Get Many',
            value: 'getMany',
            action: 'Get many conversions',
            description: 'Retrieve a list of conversion entries',
          },
        ],
        default: 'create',
      },

      // ─── Contact Operations ──────────────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['contact'] } },
        options: [
          {
            name: 'Search',
            value: 'search',
            action: 'Search contacts',
            description: 'Search contacts by name, email, or phone',
          },
        ],
        default: 'search',
      },

      // ─── Conversion Type Operations ──────────────────────────────────────
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['conversionType'] } },
        options: [
          {
            name: 'Get Many',
            value: 'getMany',
            action: 'Get all conversion types',
            description: 'List all active conversion types for your business',
          },
        ],
        default: 'getMany',
      },

      // ─── Create Conversion Fields ────────────────────────────────────────
      {
        displayName: 'Conversion Source Name or ID',
        name: 'conversionSourceId',
        type: 'options',
        required: true,
        typeOptions: {
          loadOptionsMethod: 'getConversionSources',
        },
        displayOptions: {
          show: { resource: ['conversion'], operation: ['create'] },
        },
        default: '',
        description:
          'The conversion source to record data into. Each source has its own field mappings. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Source Fields',
        name: 'sourceFields',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        displayOptions: {
          show: { resource: ['conversion'], operation: ['create'] },
        },
        default: {},
        description: 'Field values for this conversion source. Field names come from the source\'s configured field mappings.',
        placeholder: 'Add Source Field',
        options: [
          {
            name: 'fields',
            displayName: 'Field',
            values: [
              {
                displayName: 'Field Name or ID',
                name: 'key',
                type: 'options',
                typeOptions: {
                  loadOptionsMethod: 'getSourceFieldKeys',
                  loadOptionsDependsOn: ['conversionSourceId'],
                },
                default: '',
                description: 'The source field name (as configured in Cortana AI field mappings). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
                description: 'The value to send for this field',
              },
            ],
          },
        ],
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: {
          show: { resource: ['conversion'], operation: ['create'] },
        },
        default: {},
        options: [
          {
            displayName: 'Currency',
            name: 'currency',
            type: 'string',
            default: 'USD',
            description: 'ISO 4217 currency code (e.g. USD, EUR, GBP)',
          },
          {
            displayName: 'Note',
            name: 'note',
            type: 'string',
            default: '',
          },
          {
            displayName: 'Revenue',
            name: 'revenue',
            type: 'number',
            default: 0,
            description: 'Revenue value (e.g. 99.99)',
          },
          {
            displayName: 'UTM Campaign',
            name: 'utmCampaign',
            type: 'string',
            default: '',
            description: 'Campaign name or ID',
          },
          {
            displayName: 'UTM Content',
            name: 'utmContent',
            type: 'string',
            default: '',
          },
          {
            displayName: 'UTM Medium',
            name: 'utmMedium',
            type: 'string',
            default: '',
            description: 'Marketing medium (e.g. cpc, email)',
          },
          {
            displayName: 'UTM Source',
            name: 'utmSource',
            type: 'string',
            default: '',
            description: 'Traffic source (e.g. facebook, google)',
          },
          {
            displayName: 'UTM Term',
            name: 'utmTerm',
            type: 'string',
            default: '',
          },
        ],
      },

      // ─── Get Many Conversions Fields ─────────────────────────────────────
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        displayOptions: {
          show: { resource: ['conversion'], operation: ['getMany'] },
        },
        default: false,
        description: 'Whether to return all results or only up to a given limit',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1 },
        displayOptions: {
          show: {
            resource: ['conversion'],
            operation: ['getMany'],
            returnAll: [false],
          },
        },
        default: 50,
        description: 'Max number of results to return',
      },
      {
        displayName: 'Filters',
        name: 'filters',
        type: 'collection',
        placeholder: 'Add Filter',
        displayOptions: {
          show: { resource: ['conversion'], operation: ['getMany'] },
        },
        default: {},
        options: [
          {
            displayName: 'Since Date',
            name: 'since',
            type: 'dateTime',
            default: '',
            description: 'Only return conversions on or after this date',
          },
          {
            displayName: 'Conversion Type',
            name: 'type',
            type: 'string',
            default: '',
            description: 'Filter by conversion type name (e.g. lead, purchase)',
          },
          {
            displayName: 'Contact Email',
            name: 'contactEmail',
            type: 'string',
            default: '',
          },
          {
            displayName: 'Contact Phone',
            name: 'contactPhone',
            type: 'string',
            default: '',
          },
        ],
      },

      // ─── Search Contacts Fields ──────────────────────────────────────────
      {
        displayName: 'Phone Number',
        name: 'phone',
        type: 'string',
        required: true,
        displayOptions: {
          show: { resource: ['contact'], operation: ['search'] },
        },
        default: '',
        description: 'Phone number to search for (include country code, e.g. +14155552671)',
      },
      {
        displayName: 'Additional Fields',
        name: 'contactSearchFields',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: {
          show: { resource: ['contact'], operation: ['search'] },
        },
        default: {},
        options: [
          {
            displayName: 'Email',
            name: 'email',
            type: 'string',
												placeholder: 'name@email.com',
            default: '',
            description: 'Search by email instead of or in addition to phone',
          },
          {
            displayName: 'Name',
            name: 'name',
            type: 'string',
            default: '',
            description: 'Search by contact name',
          },
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            typeOptions: { minValue: 1 },
            default: 50,
            description: 'Max number of results to return',
          },
        ],
      },
    ],
  };

  methods = {
    loadOptions: {
      async getConversionSources(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('cortanaAiApi');
        const response = (await cortanaRequest(this, {
          method: 'GET',
          url: `${BASE_URL}/conversion-sources`,
          qs: { businessId: credentials.businessId as string },
        })) as IDataObject;
        return (response.data as IDataObject[]).map((source: IDataObject) => {
          const configName = (source.conversionConfig as IDataObject)?.displayName ?? (source.conversionConfig as IDataObject)?.name ?? '';
          // Encode both sourceId and conversionConfigId in the value so execute can use both
          const encodedValue = `${source.id as string}__${source.conversionConfigId as string}`;
          return {
            name: `${source.name as string}${configName ? ` (${configName})` : ''}`,
            value: encodedValue,
          };
        });
      },

      async getSourceFieldKeys(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('cortanaAiApi');
        // Get the currently selected source value (encoded as "sourceId__configId")
        const encodedSourceId = this.getCurrentNodeParameter('conversionSourceId') as string;
        if (!encodedSourceId) return [];
        const sourceId = encodedSourceId.split('__')[0];

        const response = (await cortanaRequest(this, {
          method: 'GET',
          url: `${BASE_URL}/conversion-sources`,
          qs: { businessId: credentials.businessId as string },
        })) as IDataObject;

        const sources = response.data as IDataObject[];
        const selectedSource = sources.find((s: IDataObject) => s.id === sourceId);
        if (!selectedSource || !selectedSource.fieldMappings) return [];

        const raw = selectedSource.fieldMappings as Record<string, unknown>;
        // fieldMappings may be stored as { mappings: { ... } } or flat { ... }
        const fieldMappings =
          raw.mappings && typeof raw.mappings === 'object'
            ? (raw.mappings as Record<string, unknown>)
            : raw;
        // Show the target/standard field name (e.g. "revenue") as label
        // but send the source field key (e.g. "eventValue") as value
        return Object.entries(fieldMappings)
          .filter(([sourceKey]) => !MAPPING_SKIP_KEYS.has(sourceKey))
          .map(([sourceKey, targetKey]) => ({
            name: (targetKey as string) || sourceKey,
            value: sourceKey,
          }));
      },

      async getConversionTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('cortanaAiApi');
        const response = (await cortanaRequest(this, {
          method: 'GET',
          url: `${BASE_URL}/conversion-types`,
          qs: { businessId: credentials.businessId as string },
        })) as IDataObject;
        return (response.data as IDataObject[]).map((ct: IDataObject) => ({
          name: ct.name as string,
          value: ct.id as string,
        }));
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('cortanaAiApi');
    const businessId = credentials.businessId as string;

    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;

      try {
        if (resource === 'conversion') {
          if (operation === 'create') {
            const encodedSourceId = this.getNodeParameter('conversionSourceId', i) as string;
            if (!encodedSourceId || !encodedSourceId.includes('__')) {
              throw new NodeOperationError(this.getNode(), 'Invalid conversion source selected', { itemIndex: i });
            }
            const [conversionSourceId, conversionConfigId] = encodedSourceId.split('__');

            const sourceFields = this.getNodeParameter('sourceFields', i) as IDataObject;
            const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

            const sourceFieldData: IDataObject = {};
            if (sourceFields.fields && Array.isArray(sourceFields.fields)) {
              for (const field of sourceFields.fields as IDataObject[]) {
                if (field.key && field.value !== undefined && field.value !== '') {
                  sourceFieldData[field.key as string] = field.value;
                }
              }
            }

            const body: IDataObject = {
              businessId,
              conversionSourceId,
              conversionConfigId,
              ...sourceFieldData,
              ...additionalFields,
            };

            const result = await cortanaRequest(this, {
              method: 'POST',
              url: `${BASE_URL}/conversions`,
              body,
              json: true,
            });
            returnData.push({ json: result as IDataObject, pairedItem: { item: i } });
          }

          if (operation === 'getMany') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const filters = this.getNodeParameter('filters', i) as IDataObject;

            const baseQs: IDataObject = {
              businessId,
              ...(filters.since && { since: filters.since }),
              ...(filters.type && { type: filters.type }),
              ...(filters.contactEmail && { contactEmail: filters.contactEmail }),
              ...(filters.contactPhone && { contactPhone: filters.contactPhone }),
            };

            if (returnAll) {
              // Follow cursor pagination until the server reports no more pages
              // (capped at MAX_PAGES to prevent runaway loops).
              let cursor: string | undefined;
              let pages = 0;
              do {
                const result = (await cortanaRequest(this, {
                  method: 'GET',
                  url: `${BASE_URL}/conversions`,
                  qs: {
                    ...baseQs,
                    limit: PAGE_SIZE,
                    ...(cursor ? { cursor } : {}),
                  },
                })) as IDataObject;
                const entries = (result.data as IDataObject[]) ?? [];
                for (const entry of entries) {
                  returnData.push({ json: entry, pairedItem: { item: i } });
                }
                const pagination = result.pagination as IDataObject | undefined;
                cursor = pagination?.hasMore ? (pagination.cursor as string | undefined) : undefined;
                pages++;
              } while (cursor && pages < MAX_PAGES);
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              const result = (await cortanaRequest(this, {
                method: 'GET',
                url: `${BASE_URL}/conversions`,
                qs: { ...baseQs, limit },
              })) as IDataObject;
              const entries = (result.data as IDataObject[]) ?? [];
              for (const entry of entries) {
                returnData.push({ json: entry, pairedItem: { item: i } });
              }
            }
          }
        }

        if (resource === 'contact') {
          if (operation === 'search') {
            const phone = this.getNodeParameter('phone', i) as string;
            const contactSearchFields = this.getNodeParameter('contactSearchFields', i) as IDataObject;
            const limit = (contactSearchFields.limit as number) ?? 20;
            const searchTerm = phone || (contactSearchFields.email as string) || (contactSearchFields.name as string) || '';

            if (!searchTerm) {
              throw new NodeOperationError(this.getNode(), 'Provide at least a Phone Number to search contacts', { itemIndex: i });
            }

            const result = (await cortanaRequest(this, {
              method: 'GET',
              url: `${BASE_URL}/contacts`,
              qs: { businessId, search: searchTerm, limit },
            })) as IDataObject;
            const contacts = (result.data as IDataObject[]) ?? [];
            for (const contact of contacts) {
              returnData.push({ json: contact, pairedItem: { item: i } });
            }
          }
        }

        if (resource === 'conversionType') {
          if (operation === 'getMany') {
            const result = (await cortanaRequest(this, {
              method: 'GET',
              url: `${BASE_URL}/conversion-types`,
              qs: { businessId },
            })) as IDataObject;
            const types = (result.data as IDataObject[]) ?? [];
            for (const type of types) {
              returnData.push({ json: type, pairedItem: { item: i } });
            }
          }
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        if (error instanceof NodeOperationError) throw error;
        throw new NodeApiError(this.getNode(), error as JsonObject);
      }
    }

    return [returnData];
  }
}

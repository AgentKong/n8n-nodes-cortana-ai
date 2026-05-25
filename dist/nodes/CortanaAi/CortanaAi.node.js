"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortanaAi = void 0;
const n8n_workflow_1 = require("n8n-workflow");
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
async function cortanaRequest(context, options) {
    return context.helpers.httpRequestWithAuthentication.call(context, 'cortanaAiApi', options);
}
class CortanaAi {
    constructor() {
        this.description = {
            displayName: 'Cortana AI',
            name: 'cortanaAi',
            icon: 'file:cortana-ai.svg',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"]}}',
            description: 'Create conversions and manage data in Cortana AI',
            defaults: { name: 'Cortana AI' },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
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
                    description: 'The conversion source to record data into. Each source has its own field mappings. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
        this.methods = {
            loadOptions: {
                async getConversionSources() {
                    const credentials = await this.getCredentials('cortanaAiApi');
                    const response = (await cortanaRequest(this, {
                        method: 'GET',
                        url: `${BASE_URL}/conversion-sources`,
                        qs: { businessId: credentials.businessId },
                    }));
                    return response.data.map((source) => {
                        var _a, _b, _c, _d;
                        const configName = (_d = (_b = (_a = source.conversionConfig) === null || _a === void 0 ? void 0 : _a.displayName) !== null && _b !== void 0 ? _b : (_c = source.conversionConfig) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '';
                        // Encode both sourceId and conversionConfigId in the value so execute can use both
                        const encodedValue = `${source.id}__${source.conversionConfigId}`;
                        return {
                            name: `${source.name}${configName ? ` (${configName})` : ''}`,
                            value: encodedValue,
                        };
                    });
                },
                async getSourceFieldKeys() {
                    const credentials = await this.getCredentials('cortanaAiApi');
                    // Get the currently selected source value (encoded as "sourceId__configId")
                    const encodedSourceId = this.getCurrentNodeParameter('conversionSourceId');
                    if (!encodedSourceId)
                        return [];
                    const sourceId = encodedSourceId.split('__')[0];
                    const response = (await cortanaRequest(this, {
                        method: 'GET',
                        url: `${BASE_URL}/conversion-sources`,
                        qs: { businessId: credentials.businessId },
                    }));
                    const sources = response.data;
                    const selectedSource = sources.find((s) => s.id === sourceId);
                    if (!selectedSource || !selectedSource.fieldMappings)
                        return [];
                    const raw = selectedSource.fieldMappings;
                    // fieldMappings may be stored as { mappings: { ... } } or flat { ... }
                    const fieldMappings = raw.mappings && typeof raw.mappings === 'object'
                        ? raw.mappings
                        : raw;
                    // Show the target/standard field name (e.g. "revenue") as label
                    // but send the source field key (e.g. "eventValue") as value
                    return Object.entries(fieldMappings)
                        .filter(([sourceKey]) => !MAPPING_SKIP_KEYS.has(sourceKey))
                        .map(([sourceKey, targetKey]) => ({
                        name: targetKey || sourceKey,
                        value: sourceKey,
                    }));
                },
                async getConversionTypes() {
                    const credentials = await this.getCredentials('cortanaAiApi');
                    const response = (await cortanaRequest(this, {
                        method: 'GET',
                        url: `${BASE_URL}/conversion-types`,
                        qs: { businessId: credentials.businessId },
                    }));
                    return response.data.map((ct) => ({
                        name: ct.name,
                        value: ct.id,
                    }));
                },
            },
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e;
        const credentials = await this.getCredentials('cortanaAiApi');
        const businessId = credentials.businessId;
        const items = this.getInputData();
        const returnData = [];
        for (let i = 0; i < items.length; i++) {
            const resource = this.getNodeParameter('resource', i);
            const operation = this.getNodeParameter('operation', i);
            try {
                if (resource === 'conversion') {
                    if (operation === 'create') {
                        const encodedSourceId = this.getNodeParameter('conversionSourceId', i);
                        if (!encodedSourceId || !encodedSourceId.includes('__')) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Invalid conversion source selected', { itemIndex: i });
                        }
                        const [conversionSourceId, conversionConfigId] = encodedSourceId.split('__');
                        const sourceFields = this.getNodeParameter('sourceFields', i);
                        const additionalFields = this.getNodeParameter('additionalFields', i);
                        const sourceFieldData = {};
                        if (sourceFields.fields && Array.isArray(sourceFields.fields)) {
                            for (const field of sourceFields.fields) {
                                if (field.key && field.value !== undefined && field.value !== '') {
                                    sourceFieldData[field.key] = field.value;
                                }
                            }
                        }
                        const body = {
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
                        returnData.push({ json: result, pairedItem: { item: i } });
                    }
                    if (operation === 'getMany') {
                        const returnAll = this.getNodeParameter('returnAll', i);
                        const filters = this.getNodeParameter('filters', i);
                        const baseQs = {
                            businessId,
                            ...(filters.since && { since: filters.since }),
                            ...(filters.type && { type: filters.type }),
                            ...(filters.contactEmail && { contactEmail: filters.contactEmail }),
                            ...(filters.contactPhone && { contactPhone: filters.contactPhone }),
                        };
                        if (returnAll) {
                            // Follow cursor pagination until the server reports no more pages
                            // (capped at MAX_PAGES to prevent runaway loops).
                            let cursor;
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
                                }));
                                const entries = (_a = result.data) !== null && _a !== void 0 ? _a : [];
                                for (const entry of entries) {
                                    returnData.push({ json: entry, pairedItem: { item: i } });
                                }
                                const pagination = result.pagination;
                                cursor = (pagination === null || pagination === void 0 ? void 0 : pagination.hasMore) ? pagination.cursor : undefined;
                                pages++;
                            } while (cursor && pages < MAX_PAGES);
                        }
                        else {
                            const limit = this.getNodeParameter('limit', i);
                            const result = (await cortanaRequest(this, {
                                method: 'GET',
                                url: `${BASE_URL}/conversions`,
                                qs: { ...baseQs, limit },
                            }));
                            const entries = (_b = result.data) !== null && _b !== void 0 ? _b : [];
                            for (const entry of entries) {
                                returnData.push({ json: entry, pairedItem: { item: i } });
                            }
                        }
                    }
                }
                if (resource === 'contact') {
                    if (operation === 'search') {
                        const phone = this.getNodeParameter('phone', i);
                        const contactSearchFields = this.getNodeParameter('contactSearchFields', i);
                        const limit = (_c = contactSearchFields.limit) !== null && _c !== void 0 ? _c : 20;
                        const searchTerm = phone || contactSearchFields.email || contactSearchFields.name || '';
                        if (!searchTerm) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Provide at least a Phone Number to search contacts', { itemIndex: i });
                        }
                        const result = (await cortanaRequest(this, {
                            method: 'GET',
                            url: `${BASE_URL}/contacts`,
                            qs: { businessId, search: searchTerm, limit },
                        }));
                        const contacts = (_d = result.data) !== null && _d !== void 0 ? _d : [];
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
                        }));
                        const types = (_e = result.data) !== null && _e !== void 0 ? _e : [];
                        for (const type of types) {
                            returnData.push({ json: type, pairedItem: { item: i } });
                        }
                    }
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({ json: { error: error.message }, pairedItem: { item: i } });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeOperationError)
                    throw error;
                throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
            }
        }
        return [returnData];
    }
}
exports.CortanaAi = CortanaAi;
//# sourceMappingURL=CortanaAi.node.js.map
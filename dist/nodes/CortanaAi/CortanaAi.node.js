"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortanaAi = void 0;
const BASE_URL = 'https://app.agentkong.ai/api/v1';
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
            inputs: ['main'],
            outputs: ['main'],
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
                        { name: 'Conversion', value: 'conversion' },
                        { name: 'Contact', value: 'contact' },
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
                    displayName: 'Conversion Type Name or ID',
                    name: 'conversionConfigId',
                    type: 'options',
                    required: true,
                    typeOptions: {
                        loadOptionsMethod: 'getConversionTypes',
                    },
                    displayOptions: {
                        show: { resource: ['conversion'], operation: ['create'] },
                    },
                    default: '',
                    description: 'The conversion type to record. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Email',
                    name: 'email',
                    type: 'string',
                    placeholder: 'name@email.com',
                    displayOptions: {
                        show: { resource: ['conversion'], operation: ['create'] },
                    },
                    default: '',
                    description: 'Contact email address. Required if phone is not provided.',
                },
                {
                    displayName: 'Phone',
                    name: 'phone',
                    type: 'string',
                    displayOptions: {
                        show: { resource: ['conversion'], operation: ['create'] },
                    },
                    default: '',
                    description: 'Contact phone number (include country code). Required if email is not provided.',
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
                            displayName: 'Contact Name',
                            name: 'name',
                            type: 'string',
                            default: '',
                        },
                        {
                            displayName: 'Revenue',
                            name: 'revenue',
                            type: 'number',
                            default: 0,
                            description: 'Revenue amount (e.g. 99.99)',
                        },
                        {
                            displayName: 'Currency',
                            name: 'currency',
                            type: 'string',
                            default: 'USD',
                            description: 'ISO 4217 currency code (e.g. USD, EUR, GBP)',
                        },
                        {
                            displayName: 'UTM Source',
                            name: 'utmSource',
                            type: 'string',
                            default: '',
                            description: 'Traffic source (e.g. facebook, google)',
                        },
                        {
                            displayName: 'UTM Medium',
                            name: 'utmMedium',
                            type: 'string',
                            default: '',
                            description: 'Marketing medium (e.g. cpc, email)',
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
                            displayName: 'UTM Term',
                            name: 'utmTerm',
                            type: 'string',
                            default: '',
                        },
                        {
                            displayName: 'Note',
                            name: 'note',
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
                            displayName: 'Start Date',
                            name: 'startDate',
                            type: 'dateTime',
                            default: '',
                            description: 'Filter conversions on or after this date',
                        },
                        {
                            displayName: 'End Date',
                            name: 'endDate',
                            type: 'dateTime',
                            default: '',
                            description: 'Filter conversions on or before this date',
                        },
                        {
                            displayName: 'Contact Email',
                            name: 'contactEmail',
                            type: 'string',
                            default: '',
                        },
                    ],
                },
                // ─── Search Contacts Fields ──────────────────────────────────────────
                {
                    displayName: 'Search Query',
                    name: 'query',
                    type: 'string',
                    required: true,
                    displayOptions: {
                        show: { resource: ['contact'], operation: ['search'] },
                    },
                    default: '',
                    description: 'Search contacts by name, email, or phone number',
                },
                {
                    displayName: 'Limit',
                    name: 'limit',
                    type: 'number',
                    typeOptions: { minValue: 1, maxValue: 100 },
                    displayOptions: {
                        show: { resource: ['contact'], operation: ['search'] },
                    },
                    default: 20,
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getConversionTypes() {
                    const credentials = await this.getCredentials('cortanaAiApi');
                    const response = await this.helpers.httpRequest({
                        method: 'GET',
                        url: `${BASE_URL}/conversion-types`,
                        headers: {
                            Authorization: `Bearer ${credentials.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        qs: { businessId: credentials.businessId },
                    });
                    return response.data.map((ct) => ({
                        name: ct.name,
                        value: ct.id,
                    }));
                },
            },
        };
    }
    async execute() {
        const credentials = await this.getCredentials('cortanaAiApi');
        const apiKey = credentials.apiKey;
        const businessId = credentials.businessId;
        const items = this.getInputData();
        const returnData = [];
        for (let i = 0; i < items.length; i++) {
            const resource = this.getNodeParameter('resource', i);
            const operation = this.getNodeParameter('operation', i);
            if (resource === 'conversion') {
                if (operation === 'create') {
                    const conversionConfigId = this.getNodeParameter('conversionConfigId', i);
                    const email = this.getNodeParameter('email', i);
                    const phone = this.getNodeParameter('phone', i);
                    const additionalFields = this.getNodeParameter('additionalFields', i);
                    const body = {
                        businessId,
                        conversionConfigId,
                        ...(email && { email }),
                        ...(phone && { phone }),
                        ...additionalFields,
                    };
                    const result = await this.helpers.httpRequest({
                        method: 'POST',
                        url: `${BASE_URL}/conversions`,
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body,
                    });
                    returnData.push(result);
                }
                if (operation === 'getMany') {
                    const returnAll = this.getNodeParameter('returnAll', i);
                    const limit = returnAll ? 100 : this.getNodeParameter('limit', i);
                    const filters = this.getNodeParameter('filters', i);
                    const result = await this.helpers.httpRequest({
                        method: 'GET',
                        url: `${BASE_URL}/conversions`,
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        qs: {
                            businessId,
                            limit,
                            ...(filters.startDate && { startDate: filters.startDate }),
                            ...(filters.endDate && { endDate: filters.endDate }),
                            ...(filters.contactEmail && { contactEmail: filters.contactEmail }),
                        },
                    });
                    const entries = result.data;
                    returnData.push(...(entries || []));
                }
            }
            if (resource === 'contact') {
                if (operation === 'search') {
                    const query = this.getNodeParameter('query', i);
                    const limit = this.getNodeParameter('limit', i);
                    const result = await this.helpers.httpRequest({
                        method: 'GET',
                        url: `${BASE_URL}/contacts`,
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        qs: { businessId, q: query, limit },
                    });
                    const contacts = result.data;
                    returnData.push(...(contacts || []));
                }
            }
            if (resource === 'conversionType') {
                if (operation === 'getMany') {
                    const result = await this.helpers.httpRequest({
                        method: 'GET',
                        url: `${BASE_URL}/conversion-types`,
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        qs: { businessId },
                    });
                    const types = result.data;
                    returnData.push(...(types || []));
                }
            }
        }
        return [this.helpers.returnJsonArray(returnData)];
    }
}
exports.CortanaAi = CortanaAi;
//# sourceMappingURL=CortanaAi.node.js.map
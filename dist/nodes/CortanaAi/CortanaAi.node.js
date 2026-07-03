"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortanaAi = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const DEFAULT_BASE_URL = 'https://app.agentkong.ai/api/v1';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
/** Sentinel for the source dropdown: use (or create) a source named "n8n". */
const AUTO_SOURCE = '__auto__';
/** New v1 error envelope is { error: { code, message } } — surface `message`. */
function extractErrorMessage(err) {
    var _a, _b, _c, _d, _e, _f, _g;
    const e = err;
    if (typeof (e === null || e === void 0 ? void 0 : e.error) === 'object' && ((_b = (_a = e.error) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.message))
        return e.error.error.message;
    if ((_e = (_d = (_c = e === null || e === void 0 ? void 0 : e.response) === null || _c === void 0 ? void 0 : _c.body) === null || _d === void 0 ? void 0 : _d.error) === null || _e === void 0 ? void 0 : _e.message)
        return e.response.body.error.message;
    if (typeof (e === null || e === void 0 ? void 0 : e.error) === 'string') {
        try {
            const parsed = JSON.parse(e.error);
            if ((_f = parsed === null || parsed === void 0 ? void 0 : parsed.error) === null || _f === void 0 ? void 0 : _f.message)
                return parsed.error.message;
        }
        catch {
            /* fall through */
        }
    }
    return (_g = e === null || e === void 0 ? void 0 : e.message) !== null && _g !== void 0 ? _g : 'Unknown Cortana API error';
}
async function cortanaRequest(ctx, options) {
    var _a, _b, _c, _d;
    const credentials = await ctx.getCredentials('cortanaAiApi');
    const baseUrl = (credentials.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    // Build the query string into the URL ourselves — n8n's request helper does
    // not reliably serialize the `qs` option across versions, which silently
    // dropped filters like `search`/`email` (returned unfiltered lists).
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries((_a = options.qs) !== null && _a !== void 0 ? _a : {})) {
        if (value !== undefined && value !== null && value !== '') {
            search.append(key, String(value));
        }
    }
    const qsString = search.toString();
    const url = `${baseUrl}${options.path}${qsString ? `?${qsString}` : ''}`;
    const doRequest = () => ctx.helpers.request({
        method: options.method,
        url,
        headers: {
            Authorization: `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json',
        },
        ...(options.body ? { body: options.body } : {}),
        json: true,
    });
    try {
        return (await doRequest());
    }
    catch (err) {
        // Honor Retry-After once on 429 — 60 req/min per key is easy to hit in loops.
        const statusCode = err.statusCode;
        if (statusCode === 429) {
            const retryAfter = Number((_d = (_c = (_b = err.response) === null || _b === void 0 ? void 0 : _b.headers) === null || _c === void 0 ? void 0 : _c['retry-after']) !== null && _d !== void 0 ? _d : 2);
            await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 30) * 1000));
            return (await doRequest());
        }
        throw err;
    }
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
            description: 'Create conversions and look up data in Cortana',
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
                // ─── Business (FIRST — one credential covers all businesses) ────────
                {
                    displayName: 'Business Name or ID',
                    name: 'businessId',
                    type: 'options',
                    required: true,
                    typeOptions: { loadOptionsMethod: 'getBusinesses' },
                    default: '',
                    description: 'The Cortana business this node acts on. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                // ─── Resource ───────────────────────────────────────────────────────
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
                // ─── Conversion Operations ────────────────────────────────────────
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
                            description: 'Record a new conversion entry in Cortana',
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
                // ─── Contact Operations ───────────────────────────────────────────
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
                // ─── Conversion Type Operations ───────────────────────────────────
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
                            description: 'List all active conversion types for the business',
                        },
                    ],
                    default: 'getMany',
                },
                // ─── Create Conversion Fields ─────────────────────────────────────
                {
                    displayName: 'Conversion Type Name or ID',
                    name: 'conversionConfigId',
                    type: 'options',
                    required: true,
                    typeOptions: {
                        loadOptionsMethod: 'getConversionConfigs',
                        loadOptionsDependsOn: ['businessId'],
                    },
                    displayOptions: {
                        show: { resource: ['conversion'], operation: ['create'] },
                    },
                    default: '',
                    description: 'The conversion type to record. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Source Name or ID',
                    name: 'sourceId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getConversionSources',
                        loadOptionsDependsOn: ['businessId', 'conversionConfigId'],
                    },
                    displayOptions: {
                        show: { resource: ['conversion'], operation: ['create'] },
                    },
                    default: '__auto__',
                    description: 'The conversion source the entry is attributed to. "Auto" uses (or creates) a source named "n8n" under the chosen conversion type. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
                    description: 'Contact email address. Required if phone is not provided. Existing contacts are matched by email (no duplicates).',
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
                            displayName: 'Currency',
                            name: 'currency',
                            type: 'string',
                            default: 'USD',
                            description: 'ISO 4217 currency code (e.g. USD, EUR, GBP)',
                        },
                        {
                            displayName: 'First Name',
                            name: 'firstName',
                            type: 'string',
                            default: '',
                            description: 'Used when a new contact is created',
                        },
                        {
                            displayName: 'Last Name',
                            name: 'lastName',
                            type: 'string',
                            default: '',
                            description: 'Used when a new contact is created',
                        },
                        {
                            displayName: 'Occurred At',
                            name: 'occurredAt',
                            type: 'dateTime',
                            default: '',
                            description: 'When the conversion actually happened (defaults to now)',
                        },
                        {
                            displayName: 'Revenue',
                            name: 'eventValue',
                            type: 'number',
                            default: 0,
                            description: 'Conversion value (e.g. 99.99)',
                        },
                    ],
                },
                // ─── Get Many Conversions Fields ──────────────────────────────────
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
                            displayName: 'Conversion Type Name or ID',
                            name: 'configId',
                            type: 'options',
                            typeOptions: {
                                loadOptionsMethod: 'getConversionConfigs',
                                loadOptionsDependsOn: ['businessId'],
                            },
                            default: '',
                            description: 'Only return conversions of this type. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                        },
                        {
                            displayName: 'Start Date',
                            name: 'from',
                            type: 'dateTime',
                            default: '',
                            description: 'Only conversions occurring on or after this date',
                        },
                        {
                            displayName: 'End Date',
                            name: 'to',
                            type: 'dateTime',
                            default: '',
                            description: 'Only conversions occurring on or before this date',
                        },
                    ],
                },
                // ─── Search Contacts Fields ───────────────────────────────────────
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
                    typeOptions: { minValue: 1 },
                    displayOptions: {
                        show: { resource: ['contact'], operation: ['search'] },
                    },
                    default: 50,
                    description: 'Max number of results to return',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getBusinesses() {
                    var _a;
                    const response = await cortanaRequest(this, { method: 'GET', path: '/businesses' });
                    const businesses = (_a = response.data) !== null && _a !== void 0 ? _a : [];
                    return businesses.map((b) => ({
                        name: b.name || b.id,
                        value: b.id,
                    }));
                },
                async getConversionConfigs() {
                    var _a;
                    const businessId = this.getCurrentNodeParameter('businessId');
                    if (!businessId)
                        return [];
                    const response = await cortanaRequest(this, {
                        method: 'GET',
                        path: `/businesses/${businessId}/conversions/configs`,
                        qs: { limit: 100, isActive: 'true' },
                    });
                    const configs = (_a = response.data) !== null && _a !== void 0 ? _a : [];
                    return configs.map((c) => ({
                        name: c.displayName || c.name,
                        value: c.id,
                    }));
                },
                async getConversionSources() {
                    var _a;
                    const auto = {
                        name: 'Auto — Use or Create an "N8n" Source',
                        value: AUTO_SOURCE,
                    };
                    const businessId = this.getCurrentNodeParameter('businessId');
                    const configId = this.getCurrentNodeParameter('conversionConfigId');
                    if (!businessId || !configId)
                        return [auto];
                    const response = await cortanaRequest(this, {
                        method: 'GET',
                        path: `/businesses/${businessId}/conversions/configs/${configId}/sources`,
                        qs: { limit: 100 },
                    });
                    const sources = (_a = response.data) !== null && _a !== void 0 ? _a : [];
                    return [
                        auto,
                        ...sources.map((s) => ({
                            name: s.name,
                            value: s.id,
                        })),
                    ];
                },
            },
        };
    }
    async execute() {
        var _a, _b, _c;
        const items = this.getInputData();
        const returnData = [];
        // Per-run cache so loops don't re-resolve the same source/contact.
        const sourceCache = new Map();
        const resolveSourceId = async (businessId, configId, chosen) => {
            var _a;
            if (chosen !== AUTO_SOURCE)
                return chosen;
            const cacheKey = `${businessId}:${configId}`;
            const cached = sourceCache.get(cacheKey);
            if (cached)
                return cached;
            const list = await cortanaRequest(this, {
                method: 'GET',
                path: `/businesses/${businessId}/conversions/configs/${configId}/sources`,
                qs: { limit: 100 },
            });
            const sources = (_a = list.data) !== null && _a !== void 0 ? _a : [];
            let source = sources.find((s) => (s.name || '').toLowerCase() === 'n8n' && s.isActive !== false);
            if (!source) {
                const created = await cortanaRequest(this, {
                    method: 'POST',
                    path: `/businesses/${businessId}/conversions/configs/${configId}/sources`,
                    body: { name: 'n8n' },
                });
                source = created.data;
            }
            const id = source.id;
            sourceCache.set(cacheKey, id);
            return id;
        };
        const resolveContactId = async (businessId, email, phone, extra) => {
            var _a;
            // Exact email/phone filters keep contact dedup server-consistent.
            const qs = { limit: 1 };
            if (email)
                qs.email = email;
            else
                qs.phone = phone;
            const found = await cortanaRequest(this, {
                method: 'GET',
                path: `/businesses/${businessId}/contacts`,
                qs,
            });
            const contacts = (_a = found.data) !== null && _a !== void 0 ? _a : [];
            if (contacts.length > 0)
                return contacts[0].id;
            const created = await cortanaRequest(this, {
                method: 'POST',
                path: `/businesses/${businessId}/contacts`,
                body: {
                    ...(email ? { email } : {}),
                    ...(phone ? { phone } : {}),
                    ...(extra.firstName ? { firstName: extra.firstName } : {}),
                    ...(extra.lastName ? { lastName: extra.lastName } : {}),
                    source: 'n8n',
                },
            });
            return created.data.id;
        };
        for (let i = 0; i < items.length; i++) {
            try {
                const businessId = this.getNodeParameter('businessId', i);
                const resource = this.getNodeParameter('resource', i);
                const operation = this.getNodeParameter('operation', i);
                if (resource === 'conversion' && operation === 'create') {
                    const conversionConfigId = this.getNodeParameter('conversionConfigId', i);
                    const chosenSource = this.getNodeParameter('sourceId', i, AUTO_SOURCE);
                    const email = this.getNodeParameter('email', i).trim();
                    const phone = this.getNodeParameter('phone', i).trim();
                    const additionalFields = this.getNodeParameter('additionalFields', i);
                    if (!email && !phone) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Provide an email or a phone number', {
                            itemIndex: i,
                        });
                    }
                    const sourceId = await resolveSourceId(businessId, conversionConfigId, chosenSource);
                    const contactId = await resolveContactId(businessId, email, phone, {
                        firstName: additionalFields.firstName,
                        lastName: additionalFields.lastName,
                    });
                    const body = { sourceId, contactId };
                    if (additionalFields.eventValue)
                        body.eventValue = additionalFields.eventValue;
                    if (additionalFields.currency)
                        body.currency = additionalFields.currency;
                    if (additionalFields.occurredAt) {
                        body.occurredAt = new Date(additionalFields.occurredAt).toISOString();
                    }
                    const result = await cortanaRequest(this, {
                        method: 'POST',
                        path: `/businesses/${businessId}/conversions/entries`,
                        body,
                    });
                    returnData.push(result.data);
                }
                if (resource === 'conversion' && operation === 'getMany') {
                    const returnAll = this.getNodeParameter('returnAll', i);
                    const limit = returnAll ? Infinity : this.getNodeParameter('limit', i);
                    const filters = this.getNodeParameter('filters', i);
                    const qs = {};
                    if (filters.configId)
                        qs.configId = filters.configId;
                    if (filters.from)
                        qs.from = new Date(filters.from).toISOString();
                    if (filters.to)
                        qs.to = new Date(filters.to).toISOString();
                    // New pagination: page/limit envelope with pagination.hasMore.
                    const collected = [];
                    for (let page = 1; page <= MAX_PAGES; page++) {
                        const result = await cortanaRequest(this, {
                            method: 'GET',
                            path: `/businesses/${businessId}/conversions/entries`,
                            qs: { ...qs, page, limit: Math.min(PAGE_SIZE, limit === Infinity ? PAGE_SIZE : limit) },
                        });
                        const entries = (_a = result.data) !== null && _a !== void 0 ? _a : [];
                        collected.push(...entries);
                        const pagination = result.pagination;
                        if (collected.length >= limit || !(pagination === null || pagination === void 0 ? void 0 : pagination.hasMore) || entries.length === 0)
                            break;
                    }
                    returnData.push(...(limit === Infinity ? collected : collected.slice(0, limit)));
                }
                if (resource === 'contact' && operation === 'search') {
                    const query = this.getNodeParameter('query', i);
                    const limit = this.getNodeParameter('limit', i);
                    const result = await cortanaRequest(this, {
                        method: 'GET',
                        path: `/businesses/${businessId}/contacts`,
                        qs: { search: query, limit },
                    });
                    returnData.push(...(((_b = result.data) !== null && _b !== void 0 ? _b : [])));
                }
                if (resource === 'conversionType' && operation === 'getMany') {
                    const result = await cortanaRequest(this, {
                        method: 'GET',
                        path: `/businesses/${businessId}/conversions/configs`,
                        qs: { limit: 100 },
                    });
                    returnData.push(...(((_c = result.data) !== null && _c !== void 0 ? _c : [])));
                }
            }
            catch (err) {
                if (this.continueOnFail()) {
                    returnData.push({ error: extractErrorMessage(err) });
                    continue;
                }
                if (err instanceof n8n_workflow_1.NodeOperationError)
                    throw err;
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), extractErrorMessage(err), { itemIndex: i });
            }
        }
        return [this.helpers.returnJsonArray(returnData)];
    }
}
exports.CortanaAi = CortanaAi;
//# sourceMappingURL=CortanaAi.node.js.map
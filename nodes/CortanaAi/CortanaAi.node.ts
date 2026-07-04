import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  INodeProperties,
  ILoadOptionsFunctions,
  INodePropertyOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const DEFAULT_BASE_URL = 'https://app.agentkong.ai/api/v1';

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

/** Sentinel for the source dropdown: use (or create) a source named "n8n". */
const AUTO_SOURCE = '__auto__';

const EXPRESSION_HINT =
  'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>';

/** New v1 error envelope is { error: { code, message } } — surface `message`. */
function extractErrorMessage(err: unknown): string {
  const e = err as {
    error?: { error?: { message?: string } } | string;
    response?: { body?: { error?: { message?: string } } };
    message?: string;
  };
  if (typeof e?.error === 'object' && e.error?.error?.message) return e.error.error.message;
  if (e?.response?.body?.error?.message) return e.response.body.error.message;
  if (typeof e?.error === 'string') {
    try {
      const parsed = JSON.parse(e.error) as { error?: { message?: string } };
      if (parsed?.error?.message) return parsed.error.message;
    } catch {
      /* fall through */
    }
  }
  return e?.message ?? 'Unknown Cortana API error';
}

async function cortanaRequest(
  ctx: IExecuteFunctions | ILoadOptionsFunctions,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    body?: IDataObject;
    qs?: IDataObject;
  },
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
  const doRequest = () =>
    ctx.helpers.request({
      method: options.method,
      url,
      headers: {
        Authorization: `Bearer ${credentials.apiKey as string}`,
        'Content-Type': 'application/json',
      },
      ...(options.body ? { body: options.body } : {}),
      json: true,
    });

  try {
    return (await doRequest()) as IDataObject;
  } catch (err) {
    // Honor Retry-After once on 429 — 60 req/min per key is easy to hit in loops.
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 429) {
      const retryAfter = Number(
        (err as { response?: { headers?: Record<string, string> } }).response?.headers?.[
          'retry-after'
        ] ?? 2,
      );
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 30) * 1000));
      return (await doRequest()) as IDataObject;
    }
    throw err;
  }
}

// ─── Route tables ──────────────────────────────────────────────────────
// Every path below is a live, tested endpoint of the scoped public API.

/** resource:operation → list endpoint (paginated page/limit envelope). */
const LIST_ROUTES: Record<string, (businessId: string) => string> = {
  'agent:getMany': (b) => `/businesses/${b}/agents`,
  'appointment:getMany': (b) => `/businesses/${b}/appointments`,
  'contact:getMany': (b) => `/businesses/${b}/contacts`,
  'conversation:getMany': (b) => `/businesses/${b}/conversations`,
  'conversionType:getMany': (b) => `/businesses/${b}/conversions/configs`,
  'customField:getMany': (b) => `/businesses/${b}/custom-fields`,
  'formSubmission:getMany': (b) => `/businesses/${b}/form-submissions`,
  'meetingRecording:getMany': (b) => `/businesses/${b}/meetings`,
  'shopify:getAbandonedCarts': (b) => `/businesses/${b}/shopify/abandoned-carts`,
  'shopify:getCustomers': (b) => `/businesses/${b}/shopify/customers`,
  'shopify:getOrders': (b) => `/businesses/${b}/shopify/orders`,
  'shopify:getProducts': (b) => `/businesses/${b}/shopify/products`,
  'stripe:getCustomers': (b) => `/businesses/${b}/stripe/customers`,
  'stripe:getDisputes': (b) => `/businesses/${b}/stripe/disputes`,
  'stripe:getInvoices': (b) => `/businesses/${b}/stripe/invoices`,
  'stripe:getPaymentIntents': (b) => `/businesses/${b}/stripe/payment-intents`,
  'stripe:getPaymentLinks': (b) => `/businesses/${b}/stripe/payment-links`,
  'stripe:getPayments': (b) => `/businesses/${b}/stripe/payments`,
  'stripe:getPrices': (b) => `/businesses/${b}/stripe/prices`,
  'stripe:getProducts': (b) => `/businesses/${b}/stripe/products`,
  'stripe:getPromotionCodes': (b) => `/businesses/${b}/stripe/promotion-codes`,
  'stripe:getSubscriptions': (b) => `/businesses/${b}/stripe/subscriptions`,
  'trackingSession:getMany': (b) => `/businesses/${b}/tracking/sessions`,
  'tag:getMany': (b) => `/businesses/${b}/tags`,
  'voiceCall:getMany': (b) => `/businesses/${b}/calls`,
  'whop:getConnections': (b) => `/businesses/${b}/whop/connections`,
  'whop:getCustomers': (b) => `/businesses/${b}/whop/customers`,
  'whop:getMemberships': (b) => `/businesses/${b}/whop/memberships`,
  'whop:getPayments': (b) => `/businesses/${b}/whop/payments`,
};

/** All operation values that render the shared Return All / Limit props. */
const PAGINATED_OPERATIONS = Object.keys(LIST_ROUTES)
  .map((k) => k.split(':')[1])
  .concat(['getMany'])
  .filter((v, i, a) => a.indexOf(v) === i);

/** resource:get → single-entity endpoint. */
const GET_ROUTES: Record<string, (businessId: string, id: string) => string> = {
  'agent:get': (b, id) => `/businesses/${b}/agents/${id}`,
  'appointment:get': (b, id) => `/businesses/${b}/appointments/${id}`,
  'contact:get': (b, id) => `/businesses/${b}/contacts/${id}`,
  'conversation:get': (b, id) => `/businesses/${b}/conversations/${id}`,
  'conversion:get': (b, id) => `/businesses/${b}/conversions/entries/${id}`,
  'conversionType:get': (b, id) => `/businesses/${b}/conversions/configs/${id}`,
  'formSubmission:get': (b, id) => `/businesses/${b}/form-submissions/${id}`,
  'trackingSession:get': (b, id) => `/businesses/${b}/tracking/sessions/${id}`,
  'voiceCall:get': (b, id) => `/businesses/${b}/calls/${id}`,
  'voiceCall:getTranscript': (b, id) => `/businesses/${b}/calls/${id}/transcript`,
};

/** Single-object (non-paginated) reads. */
const OBJECT_ROUTES: Record<string, (businessId: string) => string> = {
  'attribution:getPresets': (b) => `/businesses/${b}/attribution/presets`,
  'attribution:getUtms': (b) => `/businesses/${b}/attribution/utms`,
  'shopify:getAnalytics': (b) => `/businesses/${b}/shopify/analytics`,
  'stripe:getMetrics': (b) => `/businesses/${b}/stripe/metrics`,
};

// ─── Property factories (keep the 18-resource schema readable) ─────────

function idProperty(
  displayName: string,
  name: string,
  resource: string,
  operations: string[],
  description: string,
): INodeProperties {
  return {
    displayName,
    name,
    type: 'string',
    required: true,
    displayOptions: { show: { resource: [resource], operation: operations } },
    default: '',
    description,
  };
}

function operationsProperty(
  resource: string,
  options: Array<{ name: string; value: string; action: string; description: string }>,
  defaultValue: string,
): INodeProperties {
  return {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: [resource] } },
    options,
    default: defaultValue,
  };
}

const getManyOption = (noun: string) => ({
  name: 'Get Many',
  value: 'getMany',
  action: `Get many ${noun}`,
  description: `Retrieve a list of ${noun}`,
});
const getOption = (noun: string) => ({
  name: 'Get',
  value: 'get',
  action: `Get a ${noun}`,
  description: `Retrieve a single ${noun}`,
});

export class CortanaAi implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Cortana AI',
    name: 'cortanaAi',
    icon: 'file:cortana-ai.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Read and create data in Cortana — conversions, contacts, attribution, and more',
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
      // ─── Business (FIRST — one credential covers all businesses) ────────
      {
        displayName: 'Business Name or ID',
        name: 'businessId',
        type: 'options',
        required: true,
        typeOptions: { loadOptionsMethod: 'getBusinesses' },
        default: '',
        description: 'The Cortana business this node acts on. ,. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },

      // ─── Resource ───────────────────────────────────────────────────────
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Agent', value: 'agent' },
          { name: 'Appointment', value: 'appointment' },
          { name: 'Attribution', value: 'attribution' },
          { name: 'Business', value: 'business' },
          { name: 'Contact', value: 'contact' },
          { name: 'Conversation', value: 'conversation' },
          { name: 'Conversion', value: 'conversion' },
          { name: 'Conversion Type', value: 'conversionType' },
          { name: 'Custom Field', value: 'customField' },
          { name: 'Form Submission', value: 'formSubmission' },
          { name: 'Meeting Recording', value: 'meetingRecording' },
          { name: 'Message', value: 'message' },
          { name: 'Shopify', value: 'shopify' },
          { name: 'Stripe', value: 'stripe' },
          { name: 'Tag', value: 'tag' },
          { name: 'Tracking Session', value: 'trackingSession' },
          { name: 'Voice Call', value: 'voiceCall' },
          { name: 'Whop', value: 'whop' },
        ],
        default: 'conversion',
      },

      // ─── Operations per resource ────────────────────────────────────────
      operationsProperty('agent', [getOption('agent'), getManyOption('agents')], 'getMany'),
      operationsProperty(
        'appointment',
        [getOption('appointment'), getManyOption('appointments')],
        'getMany',
      ),
      operationsProperty(
        'attribution',
        [
          {
            name: 'Get Contacts by LTV',
            value: 'getContactsByLtv',
            action: 'Get contacts by LTV',
            description: 'Retrieve contacts ranked by lifetime value',
          },
          {
            name: 'Get Data',
            value: 'getData',
            action: 'Get attribution data',
            description: 'Retrieve aggregated attribution rows for a date range',
          },
          {
            name: 'Get Presets',
            value: 'getPresets',
            action: 'Get attribution presets',
            description: 'Retrieve saved attribution presets',
          },
          {
            name: 'Get UTMs',
            value: 'getUtms',
            action: 'Get UTM values',
            description: 'Retrieve known UTM values for the business',
          },
        ],
        'getData',
      ),
      operationsProperty('business', [getManyOption('businesses')], 'getMany'),
      operationsProperty(
        'contact',
        [
          {
            name: 'Create',
            value: 'create',
            action: 'Create a contact',
            description: 'Create a new contact (matched server-side, no duplicates)',
          },
          getOption('contact'),
          getManyOption('contacts'),
        ],
        'getMany',
      ),
      operationsProperty(
        'conversation',
        [getOption('conversation'), getManyOption('conversations')],
        'getMany',
      ),
      operationsProperty(
        'conversion',
        [
          {
            name: 'Create',
            value: 'create',
            action: 'Create a conversion',
            description: 'Record a new conversion entry in Cortana',
          },
          getOption('conversion entry'),
          getManyOption('conversion entries'),
        ],
        'create',
      ),
      operationsProperty(
        'conversionType',
        [getOption('conversion type'), getManyOption('conversion types')],
        'getMany',
      ),
      operationsProperty('customField', [getManyOption('custom fields')], 'getMany'),
      operationsProperty(
        'formSubmission',
        [getOption('form submission'), getManyOption('form submissions')],
        'getMany',
      ),
      operationsProperty('meetingRecording', [getManyOption('meeting recordings')], 'getMany'),
      operationsProperty('message', [getManyOption('messages')], 'getMany'),
      operationsProperty(
        'shopify',
        [
          {
            name: 'Get Abandoned Carts',
            value: 'getAbandonedCarts',
            action: 'Get Shopify abandoned carts',
            description: 'Retrieve a list of abandoned checkouts',
          },
          {
            name: 'Get Analytics',
            value: 'getAnalytics',
            action: 'Get Shopify analytics',
            description: 'Retrieve the Shopify analytics summary',
          },
          {
            name: 'Get Customers',
            value: 'getCustomers',
            action: 'Get Shopify customers',
            description: 'Retrieve a list of Shopify customers',
          },
          {
            name: 'Get Orders',
            value: 'getOrders',
            action: 'Get Shopify orders',
            description: 'Retrieve a list of Shopify orders',
          },
          {
            name: 'Get Products',
            value: 'getProducts',
            action: 'Get Shopify products',
            description: 'Retrieve a list of Shopify products',
          },
        ],
        'getOrders',
      ),
      operationsProperty(
        'stripe',
        [
          {
            name: 'Get Customers',
            value: 'getCustomers',
            action: 'Get Stripe customers',
            description: 'Retrieve a list of Stripe customers',
          },
          {
            name: 'Get Disputes',
            value: 'getDisputes',
            action: 'Get Stripe disputes',
            description: 'Retrieve a list of Stripe disputes',
          },
          {
            name: 'Get Invoices',
            value: 'getInvoices',
            action: 'Get Stripe invoices',
            description: 'Retrieve a list of Stripe invoices',
          },
          {
            name: 'Get Metrics',
            value: 'getMetrics',
            action: 'Get Stripe metrics',
            description: 'Retrieve the Stripe revenue metrics summary',
          },
          {
            name: 'Get Payment Intents',
            value: 'getPaymentIntents',
            action: 'Get Stripe payment intents',
            description: 'Retrieve a list of Stripe payment intents',
          },
          {
            name: 'Get Payment Links',
            value: 'getPaymentLinks',
            action: 'Get Stripe payment links',
            description: 'Retrieve a list of Stripe payment links',
          },
          {
            name: 'Get Payments',
            value: 'getPayments',
            action: 'Get Stripe payments',
            description: 'Retrieve a list of Stripe payments',
          },
          {
            name: 'Get Prices',
            value: 'getPrices',
            action: 'Get Stripe prices',
            description: 'Retrieve a list of Stripe prices',
          },
          {
            name: 'Get Products',
            value: 'getProducts',
            action: 'Get Stripe products',
            description: 'Retrieve a list of Stripe products',
          },
          {
            name: 'Get Promotion Codes',
            value: 'getPromotionCodes',
            action: 'Get Stripe promotion codes',
            description: 'Retrieve a list of Stripe promotion codes',
          },
          {
            name: 'Get Subscriptions',
            value: 'getSubscriptions',
            action: 'Get Stripe subscriptions',
            description: 'Retrieve a list of Stripe subscriptions',
          },
        ],
        'getPayments',
      ),
      operationsProperty('tag', [getManyOption('tags')], 'getMany'),
      operationsProperty(
        'trackingSession',
        [getOption('tracking session'), getManyOption('tracking sessions')],
        'getMany',
      ),
      operationsProperty(
        'voiceCall',
        [
          getOption('voice call'),
          getManyOption('voice calls'),
          {
            name: 'Get Transcript',
            value: 'getTranscript',
            action: 'Get a call transcript',
            description: 'Retrieve the transcript of a voice call',
          },
        ],
        'getMany',
      ),
      operationsProperty(
        'whop',
        [
          {
            name: 'Get Connections',
            value: 'getConnections',
            action: 'Get Whop connections',
            description: 'Retrieve a list of Whop connections',
          },
          {
            name: 'Get Customers',
            value: 'getCustomers',
            action: 'Get Whop customers',
            description: 'Retrieve a list of Whop customers',
          },
          {
            name: 'Get Memberships',
            value: 'getMemberships',
            action: 'Get Whop memberships',
            description: 'Retrieve a list of Whop memberships',
          },
          {
            name: 'Get Payments',
            value: 'getPayments',
            action: 'Get Whop payments',
            description: 'Retrieve a list of Whop payments',
          },
        ],
        'getPayments',
      ),

      // ─── Single-entity ID params ────────────────────────────────────────
      idProperty('Agent ID', 'entityId', 'agent', ['get'], 'ID of the agent to retrieve'),
      idProperty(
        'Appointment ID',
        'entityId',
        'appointment',
        ['get'],
        'ID of the appointment to retrieve',
      ),
      idProperty('Contact ID', 'entityId', 'contact', ['get'], 'ID of the contact to retrieve'),
      idProperty(
        'Conversation ID',
        'entityId',
        'conversation',
        ['get'],
        'ID of the conversation to retrieve',
      ),
      idProperty(
        'Entry ID',
        'entityId',
        'conversion',
        ['get'],
        'ID of the conversion entry to retrieve',
      ),
      idProperty(
        'Conversion Type ID',
        'entityId',
        'conversionType',
        ['get'],
        'ID of the conversion type to retrieve',
      ),
      idProperty(
        'Submission ID',
        'entityId',
        'formSubmission',
        ['get'],
        'ID of the form submission to retrieve',
      ),
      idProperty(
        'Session ID',
        'entityId',
        'trackingSession',
        ['get'],
        'ID of the tracking session to retrieve',
      ),
      idProperty(
        'Call ID',
        'entityId',
        'voiceCall',
        ['get', 'getTranscript'],
        'ID of the voice call',
      ),
      idProperty(
        'Conversation ID',
        'conversationId',
        'message',
        ['getMany'],
        'ID of the conversation whose messages to retrieve',
      ),

      // ─── Attribution: Get Data params ───────────────────────────────────
      {
        displayName: 'Start Date',
        name: 'startDate',
        type: 'dateTime',
        required: true,
        displayOptions: { show: { resource: ['attribution'], operation: ['getData'] } },
        default: '',
        description: 'Beginning of the reporting window',
      },
      {
        displayName: 'End Date',
        name: 'endDate',
        type: 'dateTime',
        required: true,
        displayOptions: { show: { resource: ['attribution'], operation: ['getData'] } },
        default: '',
        description: 'End of the reporting window',
      },
      {
        displayName: 'Group By',
        name: 'groupBy',
        type: 'options',
        displayOptions: { show: { resource: ['attribution'], operation: ['getData'] } },
        options: [
          { name: 'Ad', value: 'ad' },
          { name: 'Campaign', value: 'campaign' },
          { name: 'Medium', value: 'medium' },
          { name: 'Source', value: 'source' },
        ],
        default: 'source',
        description: 'Dimension to aggregate the attribution rows by',
      },
      {
        displayName: 'Attribution Model',
        name: 'attributionModel',
        type: 'options',
        displayOptions: { show: { resource: ['attribution'], operation: ['getData'] } },
        options: [
          { name: 'First Click', value: 'first_click' },
          { name: 'Last Click', value: 'last_click' },
          { name: 'Paid Priority', value: 'paid_priority' },
          { name: 'Scientific', value: 'scientific' },
        ],
        default: 'last_click',
        description: 'Attribution model used to credit conversions',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1 },
        displayOptions: { show: { resource: ['attribution'], operation: ['getContactsByLtv'] } },
        default: 50,
        description: 'Max number of results to return',
      },

      // ─── Contact: Create fields ─────────────────────────────────────────
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        placeholder: 'name@email.com',
        displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
        default: '',
        description: 'Contact email address. At least one of email, phone, or first name is required.',
      },
      {
        displayName: 'Phone',
        name: 'phone',
        type: 'string',
        displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
        default: '',
        description: 'Contact phone number (include country code)',
      },
      {
        displayName: 'Additional Fields',
        name: 'contactFields',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
        default: {},
        options: [
          {
            displayName: 'Company',
            name: 'company',
            type: 'string',
            default: '',
            description: 'Company the contact belongs to',
          },
          {
            displayName: 'First Name',
            name: 'firstName',
            type: 'string',
            default: '',
            description: 'Contact first name',
          },
          {
            displayName: 'Last Name',
            name: 'lastName',
            type: 'string',
            default: '',
            description: 'Contact last name',
          },
          {
            displayName: 'Note',
            name: 'note',
            type: 'string',
            default: '',
            description: 'Free-form note stored on the contact',
          },
          {
            displayName: 'Source',
            name: 'source',
            type: 'string',
            default: 'n8n',
            description: 'Source label stored on the contact',
          },
        ],
      },

      // ─── Contact: Get Many filters ──────────────────────────────────────
      {
        displayName: 'Filters',
        name: 'contactFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        displayOptions: { show: { resource: ['contact'], operation: ['getMany'] } },
        default: {},
        options: [
          {
            displayName: 'Email',
            name: 'email',
            type: 'string',
												placeholder: 'name@email.com',
            default: '',
            description: 'Exact email to match',
          },
          {
            displayName: 'Phone',
            name: 'phone',
            type: 'string',
            default: '',
            description: 'Exact phone number to match',
          },
          {
            displayName: 'Search',
            name: 'search',
            type: 'string',
            default: '',
            description: 'Match name, email, or phone starting with this text',
          },
          {
            displayName: 'Tag',
            name: 'tag',
            type: 'string',
            default: '',
            description: 'Only contacts carrying this tag',
          },
        ],
      },

      // ─── Conversion: Create fields (unchanged from 0.2.x) ───────────────
      {
        displayName: 'Conversion Type Name or ID',
        name: 'conversionConfigId',
        type: 'options',
        required: true,
        typeOptions: {
          loadOptionsMethod: 'getConversionConfigs',
          loadOptionsDependsOn: ['businessId'],
        },
        displayOptions: { show: { resource: ['conversion'], operation: ['create'] } },
        default: '',
        description: 'The conversion type to record. ,. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Source Name or ID',
        name: 'sourceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getConversionSources',
          loadOptionsDependsOn: ['businessId', 'conversionConfigId'],
        },
        displayOptions: { show: { resource: ['conversion'], operation: ['create'] } },
        default: '__auto__',
        description: 'The conversion source the entry is attributed to. ,. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        placeholder: 'name@email.com',
        displayOptions: { show: { resource: ['conversion'], operation: ['create'] } },
        default: '',
        description:
          'Contact email address. Required if phone is not provided. Existing contacts are matched by email (no duplicates).',
      },
      {
        displayName: 'Phone',
        name: 'phone',
        type: 'string',
        displayOptions: { show: { resource: ['conversion'], operation: ['create'] } },
        default: '',
        description:
          'Contact phone number (include country code). Required if email is not provided.',
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        displayOptions: { show: { resource: ['conversion'], operation: ['create'] } },
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

      // ─── Conversion: Get Many filters ───────────────────────────────────
      {
        displayName: 'Filters',
        name: 'filters',
        type: 'collection',
        placeholder: 'Add Filter',
        displayOptions: { show: { resource: ['conversion'], operation: ['getMany'] } },
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
            description: 'Only return conversions of this type. ,. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
          },
          {
            displayName: 'End Date',
            name: 'to',
            type: 'dateTime',
            default: '',
            description: 'Only conversions occurring on or before this date',
          },
          {
            displayName: 'Start Date',
            name: 'from',
            type: 'dateTime',
            default: '',
            description: 'Only conversions occurring on or after this date',
          },
        ],
      },

      // ─── Shared pagination (all list operations) ────────────────────────
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        displayOptions: {
          show: {
            resource: [
              'agent',
              'appointment',
              'contact',
              'conversation',
              'conversion',
              'conversionType',
              'customField',
              'formSubmission',
              'meetingRecording',
              'message',
              'shopify',
              'stripe',
              'tag',
              'trackingSession',
              'voiceCall',
              'whop',
            ],
            operation: PAGINATED_OPERATIONS,
          },
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
            resource: [
              'agent',
              'appointment',
              'contact',
              'conversation',
              'conversion',
              'conversionType',
              'customField',
              'formSubmission',
              'meetingRecording',
              'message',
              'shopify',
              'stripe',
              'tag',
              'trackingSession',
              'voiceCall',
              'whop',
            ],
            operation: PAGINATED_OPERATIONS,
            returnAll: [false],
          },
        },
        default: 50,
        description: 'Max number of results to return',
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

      async getConversionSources(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const auto: INodePropertyOptions = {
          name: 'Auto — Use or Create an "N8n" Source',
          value: AUTO_SOURCE,
        };
        const businessId = this.getCurrentNodeParameter('businessId') as string;
        const configId = this.getCurrentNodeParameter('conversionConfigId') as string;
        if (!businessId || !configId) return [auto];
        const response = await cortanaRequest(this, {
          method: 'GET',
          path: `/businesses/${businessId}/conversions/configs/${configId}/sources`,
          qs: { limit: 100 },
        });
        const sources = (response.data as IDataObject[]) ?? [];
        return [
          auto,
          ...sources.map((s) => ({
            name: s.name as string,
            value: s.id as string,
          })),
        ];
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: IDataObject[] = [];

    // Per-run cache so loops don't re-resolve the same source/contact.
    const sourceCache = new Map<string, string>();

    const paginate = async (path: string, extraQs: IDataObject, limit: number) => {
      const collected: IDataObject[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const result = await cortanaRequest(this, {
          method: 'GET',
          path,
          qs: {
            ...extraQs,
            page,
            limit: Math.min(PAGE_SIZE, limit === Infinity ? PAGE_SIZE : limit),
          },
        });
        const rows = (result.data as IDataObject[]) ?? [];
        collected.push(...rows);
        const pagination = result.pagination as IDataObject | undefined;
        if (collected.length >= limit || !pagination?.hasMore || rows.length === 0) break;
      }
      return limit === Infinity ? collected : collected.slice(0, limit);
    };

    const resolveSourceId = async (businessId: string, configId: string, chosen: string) => {
      if (chosen !== AUTO_SOURCE) return chosen;
      const cacheKey = `${businessId}:${configId}`;
      const cached = sourceCache.get(cacheKey);
      if (cached) return cached;

      const list = await cortanaRequest(this, {
        method: 'GET',
        path: `/businesses/${businessId}/conversions/configs/${configId}/sources`,
        qs: { limit: 100 },
      });
      const sources = (list.data as IDataObject[]) ?? [];
      let source = sources.find(
        (s) => ((s.name as string) || '').toLowerCase() === 'n8n' && s.isActive !== false,
      );
      if (!source) {
        const created = await cortanaRequest(this, {
          method: 'POST',
          path: `/businesses/${businessId}/conversions/configs/${configId}/sources`,
          body: { name: 'n8n' },
        });
        source = created.data as IDataObject;
      }
      const id = source.id as string;
      sourceCache.set(cacheKey, id);
      return id;
    };

    const resolveContactId = async (
      businessId: string,
      email: string,
      phone: string,
      extra: { firstName?: string; lastName?: string },
    ) => {
      // Exact email/phone filters keep contact dedup server-consistent.
      const qs: IDataObject = { limit: 1 };
      if (email) qs.email = email;
      else qs.phone = phone;
      const found = await cortanaRequest(this, {
        method: 'GET',
        path: `/businesses/${businessId}/contacts`,
        qs,
      });
      const contacts = (found.data as IDataObject[]) ?? [];
      if (contacts.length > 0) return contacts[0].id as string;

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
      return (created.data as IDataObject).id as string;
    };

    for (let i = 0; i < items.length; i++) {
      try {
        const businessId = this.getNodeParameter('businessId', i) as string;
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;
        const routeKey = `${resource}:${operation}`;

        // ── Generic single-entity reads ──
        if (GET_ROUTES[routeKey]) {
          const idParam = resource === 'message' ? 'conversationId' : 'entityId';
          const id = this.getNodeParameter(idParam, i) as string;
          const result = await cortanaRequest(this, {
            method: 'GET',
            path: GET_ROUTES[routeKey](businessId, id),
          });
          returnData.push((result.data as IDataObject) ?? result);
          continue;
        }

        // ── Generic single-object reads ──
        if (OBJECT_ROUTES[routeKey]) {
          const result = await cortanaRequest(this, {
            method: 'GET',
            path: OBJECT_ROUTES[routeKey](businessId),
          });
          const data = result.data as IDataObject | IDataObject[];
          if (Array.isArray(data)) returnData.push(...data);
          else returnData.push(data ?? result);
          continue;
        }

        // ── Generic paginated lists ──
        if (LIST_ROUTES[routeKey]) {
          const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
          const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i, 50) as number);
          const extraQs: IDataObject = {};
          if (resource === 'contact') {
            Object.assign(extraQs, this.getNodeParameter('contactFilters', i, {}) as IDataObject);
          }
          returnData.push(...(await paginate(LIST_ROUTES[routeKey](businessId), extraQs, limit)));
          continue;
        }

        // ── Business: Get Many (account-level, not business-scoped) ──
        if (routeKey === 'business:getMany') {
          const result = await cortanaRequest(this, { method: 'GET', path: '/businesses' });
          returnData.push(...(((result.data as IDataObject[]) ?? [])));
          continue;
        }

        // ── Message: Get Many (nested under a conversation) ──
        if (routeKey === 'message:getMany') {
          const conversationId = this.getNodeParameter('conversationId', i) as string;
          const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
          const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i, 50) as number);
          returnData.push(
            ...(await paginate(
              `/businesses/${businessId}/conversations/${conversationId}/messages`,
              {},
              limit,
            )),
          );
          continue;
        }

        // ── Attribution ──
        if (routeKey === 'attribution:getData') {
          const startDate = new Date(this.getNodeParameter('startDate', i) as string).toISOString();
          const endDate = new Date(this.getNodeParameter('endDate', i) as string).toISOString();
          const result = await cortanaRequest(this, {
            method: 'GET',
            path: `/businesses/${businessId}/attribution/data`,
            qs: {
              startDate,
              endDate,
              groupBy: this.getNodeParameter('groupBy', i) as string,
              attributionModel: this.getNodeParameter('attributionModel', i) as string,
            },
          });
          const payload = (result.data as IDataObject) ?? {};
          const rows = payload.data as IDataObject[] | undefined;
          if (Array.isArray(rows)) returnData.push(...rows);
          else returnData.push(payload);
          continue;
        }
        if (routeKey === 'attribution:getContactsByLtv') {
          const limit = this.getNodeParameter('limit', i, 50) as number;
          const result = await cortanaRequest(this, {
            method: 'GET',
            path: `/businesses/${businessId}/attribution/contacts-by-ltv`,
            qs: { limit },
          });
          returnData.push(...(((result.data as IDataObject[]) ?? [])));
          continue;
        }

        // ── Contact: Create ──
        if (routeKey === 'contact:create') {
          const email = (this.getNodeParameter('email', i) as string).trim();
          const phone = (this.getNodeParameter('phone', i) as string).trim();
          const fields = this.getNodeParameter('contactFields', i, {}) as IDataObject;
          if (!email && !phone && !fields.firstName) {
            throw new NodeOperationError(
              this.getNode(),
              'Provide an email, a phone number, or a first name',
              { itemIndex: i },
            );
          }
          const result = await cortanaRequest(this, {
            method: 'POST',
            path: `/businesses/${businessId}/contacts`,
            body: {
              ...(email ? { email } : {}),
              ...(phone ? { phone } : {}),
              ...fields,
            },
          });
          returnData.push((result.data as IDataObject) ?? result);
          continue;
        }

        // ── Conversion: Create (the 0.2.x flow, unchanged) ──
        if (routeKey === 'conversion:create') {
          const conversionConfigId = this.getNodeParameter('conversionConfigId', i) as string;
          const chosenSource = this.getNodeParameter('sourceId', i, AUTO_SOURCE) as string;
          const email = (this.getNodeParameter('email', i) as string).trim();
          const phone = (this.getNodeParameter('phone', i) as string).trim();
          const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

          if (!email && !phone) {
            throw new NodeOperationError(this.getNode(), 'Provide an email or a phone number', {
              itemIndex: i,
            });
          }

          const sourceId = await resolveSourceId(businessId, conversionConfigId, chosenSource);
          const contactId = await resolveContactId(businessId, email, phone, {
            firstName: additionalFields.firstName as string | undefined,
            lastName: additionalFields.lastName as string | undefined,
          });

          const body: IDataObject = { sourceId, contactId };
          if (additionalFields.eventValue) body.eventValue = additionalFields.eventValue;
          if (additionalFields.currency) body.currency = additionalFields.currency;
          if (additionalFields.occurredAt) {
            body.occurredAt = new Date(additionalFields.occurredAt as string).toISOString();
          }

          const result = await cortanaRequest(this, {
            method: 'POST',
            path: `/businesses/${businessId}/conversions/entries`,
            body,
          });
          returnData.push(result.data as IDataObject);
          continue;
        }

        // ── Conversion: Get Many (typed filters) ──
        if (routeKey === 'conversion:getMany') {
          const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
          const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i, 50) as number);
          const filters = this.getNodeParameter('filters', i, {}) as IDataObject;

          const qs: IDataObject = {};
          if (filters.configId) qs.configId = filters.configId;
          if (filters.from) qs.from = new Date(filters.from as string).toISOString();
          if (filters.to) qs.to = new Date(filters.to as string).toISOString();

          returnData.push(
            ...(await paginate(`/businesses/${businessId}/conversions/entries`, qs, limit)),
          );
          continue;
        }

        throw new NodeOperationError(
          this.getNode(),
          `Unsupported operation "${operation}" for resource "${resource}"`,
          { itemIndex: i },
        );
      } catch (err) {
        if (this.continueOnFail()) {
          returnData.push({ error: extractErrorMessage(err) });
          continue;
        }
        if (err instanceof NodeOperationError) throw err;
        throw new NodeOperationError(this.getNode(), extractErrorMessage(err), { itemIndex: i });
      }
    }

    return [this.helpers.returnJsonArray(returnData)];
  }
}

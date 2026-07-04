# n8n-nodes-cortana-ai

Cortana AI community node for [n8n](https://n8n.io) — trigger workflows on new
conversions or contacts, create conversions with full attribution, and look up
contacts and conversion types.

## Installation

In n8n: **Settings → Community Nodes → Install** and enter
`n8n-nodes-cortana-ai`.

## Credentials

1. In Cortana, open **Control Center → Settings → API Keys** and generate a key
   (`sk-ak-…`) with these scopes:
   `contacts:read, contacts:write, conversions:read, conversions:write, webhooks:read, webhooks:write`.
2. In n8n, create a **Cortana AI API** credential and paste the key.

One credential covers every business the key can access — you pick the business
on each node. The credential test calls `GET /api/v1/businesses`; if it succeeds
but the Business dropdown is empty, the key has no accessible businesses
(restricted allowlist) — create a key with the right business scope.

The optional **Base URL** field defaults to Cortana cloud
(`https://app.agentkong.ai/api/v1`); override it only for local or staging
testing (e.g. `http://localhost:3000/api/v1`).

## Nodes

### Cortana AI (action)

| Resource | Operations |
|---|---|
| Conversion | Create (contact matched by email/phone, auto-managed source), Get, Get Many |
| Contact | Create, Get, Get Many (search / email / phone / tag filters) |
| Attribution | Get Data (date range, model, group-by), Get UTMs, Get Presets, Get Contacts by LTV |
| Agent · Appointment · Conversation · Conversion Type · Form Submission · Tracking Session | Get, Get Many |
| Custom Field · Tag · Meeting Recording · Business | Get Many |
| Message | Get Many (per conversation) |
| Voice Call | Get, Get Many, Get Transcript |
| Stripe | Payments, Subscriptions, Customers, Metrics, Products, Invoices, Disputes, Payment Intents, Payment Links, Prices, Promotion Codes |
| Shopify | Orders, Customers, Products, Analytics, Abandoned Carts |
| Whop | Payments, Connections, Customers, Memberships |

### Cortana AI Trigger

Fires on **New Conversion** (optionally filtered to specific conversion types)
and/or **New Contact**. Activation registers a webhook subscription with
Cortana; deactivation removes it. Payloads are signed
(`X-Cortana-Signature: t=<ts>,v1=<hmac>`) and verified against the stored
signing secret by default — invalid signatures are logged and ignored.

Payload shape (v2 envelope):

```jsonc
{
  "event": "conversion.created",
  "deliveryId": "…",          // unique per delivery
  "timestamp": "…",
  "businessId": "…",
  "id": "…",                  // entity id — dedup key across redeliveries
  "data": {
    "conversion": { "id": "…", "type": "purchase", "displayName": "New Deals Closed", "value": 99.9, "currency": "USD", "occurredAt": "…", "createdAt": "…", "attributionMethod": "…", "metadata": null },
    "contact": { "id": "…", "email": "…", "phone": "…", "firstName": "…", "lastName": "…", "name": "…", "company": "…", "tags": [], "customFields": {}, "createdAt": "…" },
    "attribution": { "source": "…", "medium": "…", "campaign": "…", "ad": "…", "fbclid": null, "gclid": null, "firstTouch": null, "lastTouch": null }
  }
}
```

`data.contact` is `null` for anonymous conversions. Compare `occurredAt` with
`createdAt` to detect late/backfilled events.

## Migrating from 0.1.x

Version 0.2.0 is a **breaking release** — 0.1.x called an API that no longer
exists, so every 0.1.x node has been non-functional:

1. **Old `ak_live_*` keys don't work.** Create a new `sk-ak-` key with the
   scopes listed above and update your credential (the `businessId` field is
   gone from the credential).
2. **Re-select the business** on every Cortana node — it's now the first
   parameter on both nodes.
3. **Re-activate trigger workflows.** Old subscriptions never existed
   server-side (activation errors on 0.1.x were expected); deactivate + activate
   each trigger workflow once to register it.
4. The trigger's filter now uses **conversion types** (not source ids).

## Development

```bash
npm install
npm run build     # tsc + icon copy into dist/
npm run lint
```

## License

MIT

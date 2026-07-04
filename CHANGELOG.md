# Changelog

## 0.3.0 — 2026-07

Full API coverage: the action node now exposes every read surface of the
Cortana public API.

### Added
- New resources: Agent, Appointment, Attribution (Data / UTMs / Presets /
  Contacts by LTV), Business, Conversation, Custom Field, Form Submission,
  Meeting Recording, Message, Shopify (Orders / Customers / Products /
  Analytics / Abandoned Carts), Stripe (11 operations incl. Payments,
  Subscriptions, Customers, Metrics), Tag, Tracking Session, Voice Call
  (incl. Get Transcript), Whop (Payments / Connections / Customers /
  Memberships).
- Get operations for Conversion entries and Conversion Types.
- Contact → Create, and Get Many filters (search / email / phone / tag).
- Shared Return All pagination across every list operation.

### Changed
- Contact → Search is now **Contact → Get Many** with a "Search" filter
  (re-select the operation if you used Search in 0.2.x).

## 0.2.1 — 2026-07

Compliance/metadata release — functionally identical to 0.2.0, published through
the repo's release pipeline (lint gate + npm provenance). Supersedes the
manually-published 0.2.0.

### Changed
- Restored codex metadata files (`*.node.json`) and the approved `cortana-ai.svg`
  icons (node + credential) in the shipped package.
- `inputs`/`outputs` use `NodeConnectionTypes.Main` (n8n review requirement).
- Credential `documentationUrl` is a real URL (was a broken camelCase slug).
- Lint-clean against `eslint-plugin-n8n-nodes-base` (alphabetized collection
  options, canonical dynamic-options descriptions, Contact Search limit
  default 50).

## 0.2.0 — 2026-07

**Breaking release.** Rebuilt on the scoped public API
(`/api/v1/businesses/{businessId}/…`) — 0.1.x called a retired API and has been
non-functional since the migration.

### Changed
- Credential is now **API key only** (`sk-ak-…`); `businessId` removed — the
  business is chosen per node via a new dropdown (first parameter, both nodes).
- Credential test now calls `GET /api/v1/businesses`.
- All endpoints remapped to the scoped shape (`/businesses/{id}/conversions/entries`,
  `/businesses/{id}/contacts`, `/businesses/{id}/conversions/configs`,
  `/businesses/{id}/webhooks`).
- Get Many pagination rewritten for the `page`/`limit` envelope (was cursor).
- Error messages now surface the API's `error.message` instead of `[object Object]`.
- Trigger filter is by **conversion type** (was source id) and matches the
  server-side `conversionConfigIds` filter semantics.
- Node renamed Cortana AI (package `n8n-nodes-cortana-ai`).

### Added
- **New Contact** trigger event (`contact.created`).
- Webhook **signature verification** (`X-Cortana-Signature`, Stripe-style
  `t=…,v1=…` HMAC-SHA256, 5-minute tolerance) — on by default.
- Trigger `checkExists` now heals server-side deletions by re-subscribing.
- Create Conversion resolves/creates the contact by email/phone (server-side
  dedup) and auto-manages an "n8n" conversion source.
- 429 handling honors `Retry-After`.

## 0.1.x

Initial AgentKong-branded releases (retired).

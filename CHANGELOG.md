# Changelog

## 0.3.3 — 2026-07

Review-compliance release addressing the n8n community-node review of 0.3.0.
No functional or API changes.

### Fixed
- 429 retry backoff no longer uses the restricted `setTimeout` global; it now
  awaits the `sleep` helper from `n8n-workflow` (satisfies
  `@n8n/community-nodes/no-restricted-globals`).
- HTTP failures from the Cortana API are now surfaced as `NodeApiError` instead
  of `NodeOperationError`, preserving the HTTP status code and response body in
  the n8n execution UI.
- Removed the `console.warn` in the trigger's invalid-signature path; the webhook
  already returns a silent 200 with no workflow run.
- Codex category `Marketing` → `Marketing & Content` (the only supported value;
  the unsupported one was silently dropped by the n8n UI) in both node codex
  files.

> Note: 0.3.2 was tagged in git but never published to npm; 0.3.3 is the first
> npm release on top of the 0.3.x API-coverage work.

## 0.3.1 — 2026-07

### Changed
- Default API host is now `https://app.usecortana.ai/api/v1` (was the legacy
  `app.agentkong.ai` alias, which redirects and could drop the auth header on
  the hop). Credential Base URL, both nodes, the credential test, and the docs
  links all point at the canonical host. Override Base URL on the credential for
  self-hosted/staging.

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

> # ⚠️ ACTIVE MALWARE FOUND IN THIS REPO — READ FIRST
>
> During the 2026-08-03 security audit this repository was found to contain an **active malware implant**:
> a fake VS Code task (`.vscode/tasks.json`, mislabeled `eslint-check`) that **auto-executes on folder-open**
> a disguised JavaScript payload at `public/fonts/fa-solid-400.woff2` (md5 `8890135a92e0a63634bb762d2479ff57`).
> It is an EtherHiding credential-stealer/loader (C2 resolved via the Ethereum blockchain).
>
> - **Full incident report + IOCs + containment runbook:** `AgentKong_App/security/INCIDENT-2026-08-malware-implant.md`
> - The malicious files were **removed on branch `claude/security-soc2-audit-vzp6ar`** (commit `security: remove malware implant`).
> - **Removal is NOT full containment.** Any machine that opened this repo in an editor must be treated as
>   compromised; rotate all API keys (`sk-ak-`, `sk-ext-`) and the `flo-ct-flo360` AWS credentials, and purge
>   the payload from git history.
>
> ---
>

# n8n-nodes-cortana-ai — Security & SOC2 Audit

READ-ONLY audit of `/home/user/n8n-nodes-cortana-ai` (n8n community node package, v0.3.3, MIT).
Scope: `credentials/*.ts`, `nodes/CortanaAi/*.ts`. Cross-repo references to the Cortana "open API"
in `/home/user/AgentKong_App/src/app/api/v1` and `src/lib/api/v1` are cited where relevant.
Evidence is cited as `file:line`. Anything not directly observed is marked UNVERIFIED.

## Stack & attack surface

- **Package**: TypeScript n8n community node; compiled to `dist/` and published to npm. Two nodes plus
  one credential type.
- **Credential** (`credentials/CortanaAiApi.credentials.ts`): single `cortanaAiApi` type holding an API
  key (`sk-ak-…`) and a configurable Base URL. Auth is HTTP Bearer.
- **Action node** (`nodes/CortanaAi/CortanaAi.node.ts`, 1313 lines): 18 resources over the scoped v1 API
  — contacts, conversions, attribution, Stripe, Shopify, Whop, voice-call transcripts, meeting
  recordings, conversations/messages, tracking sessions, form submissions. Read + create.
- **Trigger node** (`nodes/CortanaAi/CortanaAiTrigger.node.ts`, 289 lines): registers an outbound
  webhook subscription with Cortana; receives signed `POST` callbacks and verifies HMAC-SHA256.
- **HTTP client**: hand-rolled around `ctx.helpers.request` in both nodes; query string built with
  `URLSearchParams`, path segments interpolated raw.
- **Attack surface**: (a) the credential (API key custody, where the Bearer token is sent); (b) the
  inbound webhook endpoint (forged-event injection); (c) path/URL construction; (d) the breadth of data
  reachable by one long-lived key (financial + PII) against the cross-repo open API.
- **Good baselines observed**: API key marked `password: true` (`credentials/CortanaAiApi.credentials.ts:31`);
  key sent only in the `Authorization` header, never in query string or logs; **no** `console.*`/logging of
  secrets or PII anywhere (grep clean); **no** `rejectUnauthorized:false` / `allowUnauthorizedCerts` /
  TLS-disabling flags anywhere (grep clean); HMAC compare uses `timingSafeEqual`
  (`CortanaAiTrigger.node.ts:72`); no hardcoded secrets.

## Findings

### N8N-01 — Webhook signature verification fails open when the signing secret is absent
- **Severity**: High
- **CWE/OWASP**: CWE-347 Improper Verification of Cryptographic Signature; OWASP API2:2023 Broken Authentication
- **Location**: `nodes/CortanaAi/CortanaAiTrigger.node.ts:269` (guard `if (verify && secret)`), context
  `:263-287`; secret deletion paths `:201-203`, `:207-209`.
- **Description**: The inbound webhook handler only verifies the HMAC when BOTH `verifySignature` is true
  AND a `signingSecret` is present in workflow static data. If `secret` is `undefined`, the entire
  verification block is skipped and the payload is accepted and dispatched to the workflow unverified
  (`:284-286`). The secret is deleted from static data on any error or inactive-subscription result in
  `checkExists` (`:201-203`, `:207-209`) and in `delete` (`:256-257`). A webhook can therefore keep
  receiving deliveries (or be re-driven) in a state where `subscriptionId`/secret were cleared but the
  endpoint still processes POSTs — verification silently no-ops rather than rejecting. This is a fail-open
  design on a security control.
- **Exploit scenario**: An attacker who learns or guesses the n8n webhook URL POSTs a forged
  `conversion.created` / `contact.created` envelope (shape is public — README:53-68). If the stored secret
  is absent (static data cleared, workflow imported/re-created without it, subscription healed), the forged
  event starts a real workflow run with attacker-controlled contact/revenue/attribution data, corrupting
  downstream automations (CRM writes, notifications, revenue reporting).
- **Remediation**: Fail closed — when `verify` is true and `secret` is missing, reject (return no workflow
  data) instead of processing. Treat "verification requested but impossible" as a hard failure, and surface
  it to the user rather than silently accepting.
- **SOC2 mapping**: CC6.1 (logical access — authenticity of inbound requests), CC7.2 (detection of
  anomalous/forged events).
- **Cross-repo?**: No (verification logic lives entirely in the node). Signing secret is issued by the
  open API `webhooks` handler (`AgentKong_App/src/lib/api/v1/handlers/webhooks.ts`).

### N8N-02 — Base URL is unvalidated and permits cleartext http:// and arbitrary hosts (Bearer-key exposure / SSRF)
- **Severity**: Medium
- **CWE/OWASP**: CWE-319 Cleartext Transmission of Sensitive Information; CWE-522 Insufficiently Protected
  Credentials; CWE-918 SSRF; OWASP API8:2023
- **Location**: `credentials/CortanaAiApi.credentials.ts:38-44` (free-text `baseUrl`, `http://…` example),
  `:61` (test uses it verbatim); consumed at `nodes/CortanaAi/CortanaAi.node.ts:55,65-67` and
  `nodes/CortanaAi/CortanaAiTrigger.node.ts:29,39-40`.
- **Description**: `baseUrl` is a plain string with no scheme/host validation. The node prepends it to
  every request and attaches `Authorization: Bearer <apiKey>` (`CortanaAi.node.ts:71`,
  `CortanaAiTrigger.node.ts:44`). The credential UI actively suggests an `http://localhost:3000` override
  (`:43`). Any value the credential owner sets — including a plaintext `http://` origin or an
  attacker-controlled host — receives the live API key. There is no allowlist restricting the Bearer token
  to `usecortana.ai`.
- **Exploit scenario**: (a) A user follows the "staging" guidance and points at `http://…`; the `sk-ak-`
  key traverses the network in cleartext and is captured by a passive MITM. (b) In a shared/compromised
  n8n instance, an attacker edits the Base URL to `https://evil.example/api/v1`; the next credential test
  or node run exfiltrates the API key to the attacker, who then has full scoped access to the tenant's
  data via the real API.
- **Remediation**: Validate `baseUrl` — require `https://` (allow `http://localhost`/loopback only), and
  ideally pin/allowlist the production host. Reject non-HTTPS remote hosts before sending the Bearer token.
- **SOC2 mapping**: CC6.1, CC6.7 (protect credentials/data in transit).
- **Cross-repo?**: No (client-side), but the exfiltrated key grants access to the AgentKong_App open API.

### N8N-03 — Path segments interpolated without URL-encoding (path / parameter injection)
- **Severity**: Medium
- **CWE/OWASP**: CWE-88 Argument/Parameter Injection; CWE-23/CWE-22 Path Traversal; OWASP API8:2023
- **Location**: no `encodeURIComponent` anywhere (grep confirmed). Raw interpolation in the route tables
  `nodes/CortanaAi/CortanaAi.node.ts:100-157` and throughout `execute` — e.g. `GET_ROUTES` `:140-150`,
  the `resolveContactId`/`resolveSourceId` paths `:1044,1054,1076`, `message:getMany` `:1153`,
  and `CortanaAiTrigger.node.ts:197,221,250`. `businessId`, `entityId`, `conversationId`,
  `conversionConfigId`, `sourceId` all reach the path unencoded.
- **Description**: Query parameters are safely serialized via `URLSearchParams`
  (`CortanaAi.node.ts:58-63`), but path IDs are concatenated directly into the URL. `businessId` and the
  various `entityId`/`conversationId`/`configId` fields accept free-text expressions (they are
  `type:'options'` dropdowns but also documented to accept expression input, README/description at
  `:235,776,788`). A value containing `../`, `?`, `#`, or `%` alters the request path/query — e.g. an
  `entityId` of `../webhooks` or `x?admin=1` changes which endpoint/params the authenticated key hits.
- **Exploit scenario**: A workflow author (or an upstream node feeding `entityId` from untrusted data)
  supplies `../../<other-path>`; the node issues an authenticated request to an endpoint other than the one
  the UI implies. Because it rides the caller's own key the blast radius is bounded by that key's scope,
  but it defeats the per-operation intent and can reach write/other endpoints the key happens to hold.
- **Remediation**: `encodeURIComponent` every interpolated path segment; reject IDs containing `/`, `?`,
  `#`. Prefer passing a strict ID validator.
- **SOC2 mapping**: CC6.1, CC8.1 (input validation in change/data handling).
- **Cross-repo?**: Partial — server-side authorization in `AgentKong_App/src/app/api/v1/[[...path]]/route.ts`
  is the backstop; the node should not rely on it.

### N8N-04 — Over-broad, single long-lived key: credential docs understate required scopes, driving all-scope keys (least privilege)
- **Severity**: Medium
- **CWE/OWASP**: CWE-272 Least Privilege Violation; CWE-522; OWASP API5:2023 Broken Function Level
  Authorization (over-provisioning)
- **Location**: node advertises Stripe/Shopify/Whop/meetings/conversations/messages/agents/appointments/
  tracking/tags/custom-fields/attribution/form-submissions resources
  (`CortanaAi.node.ts:244-263`, route tables `:100-157`), but the credential + README instruct users to
  create keys with ONLY `contacts:*, conversions:*, webhooks:*`
  (`credentials/CortanaAiApi.credentials.ts:9-16,34-35`; `README.md:14-16`).
- **Description**: The documented six scopes do not cover most of what the node exposes. Cross-repo, those
  endpoints require distinct scopes: `stripe:read`, `shopify:read`, `whop:read`, `meetings:read`,
  `conversations:read`, `messages:read`, `agents:read`, `appointments:read`, `tracking:read`,
  `tags:read`, `custom_fields:read`, `attribution:read`, `form_submissions:read`
  (`AgentKong_App/src/lib/api/v1/scopes.ts:8-40`; `src/app/api/v1/[[...path]]/route.ts:392-460`). A user
  who wants those features to work will grant a broad or all-scopes key. That single key then reaches
  **financial data (Stripe/Shopify/Whop payments, disputes, invoices)** and **sensitive PII (voice-call
  transcripts, meeting recordings, conversation messages)** — far beyond the "conversions/contacts" framing.
  Compounding it, the open API defaults business scope to `'all'` when absent/malformed
  (`AgentKong_App/src/lib/api/v1/scopes.ts:65-76`), so a key is effectively every-business by default, and
  the credential is a single static key with no rotation/expiry surfaced in the node UI.
- **Exploit scenario**: A leaked/exfiltrated credential (see N8N-02) or a compromised n8n instance yields
  one key that can read a tenant's entire payment history and call transcripts across all businesses — a
  high-value single point of failure, disproportionate to the "record a conversion" use case most users
  install the node for.
- **Remediation**: Document the actual minimal scope per resource; encourage per-integration keys scoped
  to the specific business(es) and only the resources used; support key expiry/rotation. On the API side,
  do not default absent business scope to `'all'`.
- **SOC2 mapping**: CC6.1, CC6.3 (least privilege / role-based access), CC6.7.
- **Cross-repo?**: Yes — scope enforcement and the fail-open `'all'` business default live in
  `AgentKong_App/src/lib/api/v1/scopes.ts` and `src/app/api/v1/[[...path]]/route.ts`.

### N8N-05 — Webhook signing secret persisted in workflow static data (at-rest exposure)
- **Severity**: Low
- **CWE/OWASP**: CWE-312 Cleartext Storage of Sensitive Information
- **Location**: `nodes/CortanaAi/CortanaAiTrigger.node.ts:236` (`webhookData.signingSecret = data.signingSecret`),
  read at `:267`.
- **Description**: The HMAC signing secret is stored via `getWorkflowStaticData('node')`, i.e. within the
  workflow record, not in the encrypted credential store. Depending on the n8n deployment, workflow static
  data may be stored unencrypted in the database and included in workflow exports/backups. Anyone with DB
  or export access recovers the secret and can then forge valid signatures.
- **Exploit scenario**: An operator exports the workflow JSON (or reads the n8n DB) and obtains the secret,
  then crafts payloads with a valid `X-Cortana-Signature`, fully defeating N8N-01's control even when it is
  working.
- **Remediation**: Store the signing secret in the encrypted credential/secret store rather than plain
  workflow static data; scrub it from exports. (Partly an n8n-platform constraint — document the risk.)
- **SOC2 mapping**: CC6.1, CC6.7.
- **Cross-repo?**: No.

### N8N-06 — Signature verification is user-toggleable and rejections are silent (control + audit gap)
- **Severity**: Low
- **CWE/OWASP**: CWE-347; CWE-778 Insufficient Logging; OWASP API9:2023
- **Location**: toggle `nodes/CortanaAi/CortanaAiTrigger.node.ts:146-154` (default true, but can be turned
  off); silent drop `:277-281`. README claims invalid signatures are "logged and ignored"
  (`README.md:50-51`) but the code emits no log (grep for logging is clean).
- **Description**: Users can disable signature verification entirely, converting the endpoint into an
  unauthenticated trigger. When verification does reject, the handler returns `200` with no workflow run
  and no audit record, so forged/failed deliveries are invisible to operators — contradicting the
  documented behavior and leaving no detection trail.
- **Exploit scenario**: An operator disables verification "to debug," leaving a forgeable endpoint; or an
  ongoing forgery attempt against a properly-verifying node produces no signal for incident response.
- **Remediation**: Emit an auditable warning on verification failure; consider gating the "off" setting or
  warning prominently. Align README with actual behavior.
- **SOC2 mapping**: CC7.2, CC7.3 (detection & evaluation of security events).
- **Cross-repo?**: No.

## Secrets scan

- No hardcoded API keys, tokens, or signing secrets in source (`grep` for `sk-ak-`, `ak_live`,
  `secret=`, `apikey=`, `password=`, `bearer` returned only legitimate references: the `password:true`
  flag, the `Authorization: Bearer {{$credentials.apiKey}}` templates, and doc text).
- API key is correctly a masked credential field (`credentials/CortanaAiApi.credentials.ts:31`,
  `typeOptions:{password:true}`) and is transmitted only in the `Authorization` header — never in a query
  string, URL, or log.
- Only cleartext-URL reference is the documentation example `http://localhost:3000/api/v1`
  (`credentials/CortanaAiApi.credentials.ts:43`) — see N8N-02.
- `dist/` contains only compiled copies of the audited sources and the SVG icon; no bundled secrets.
- `.gitignore` excludes `.env*`, `*.pem`, and `gcp-credentials.json` (`/.gitignore`) — appropriate.

## SOC2 control gaps

- **CC6.1 / CC6.7 (access & credential protection)**: Bearer key can be routed to any host over cleartext
  (N8N-02); one over-scoped, non-expiring key reaches financial + PII data (N8N-04); signing secret stored
  in plaintext workflow data (N8N-05).
- **CC6.3 (least privilege)**: credential documentation understates required scopes, steering users to
  broad/all-scope keys; API defaults business scope to `'all'` (N8N-04).
- **CC7.2 / CC7.3 (detection)**: forged-webhook fail-open (N8N-01) and silent, unlogged signature
  rejections (N8N-06) mean tampering produces no signal.
- **CC8.1 (input validation)**: unencoded path interpolation (N8N-03).

## Top priorities

1. **N8N-01 (High)** — Make webhook verification fail **closed**: reject when `verify` is set but the
   signing secret is absent. `CortanaAiTrigger.node.ts:269`.
2. **N8N-02 (Medium)** — Validate/allowlist `baseUrl`: require HTTPS for remote hosts before sending the
   Bearer key. `CortanaAiApi.credentials.ts:38-44`.
3. **N8N-03 (Medium)** — `encodeURIComponent` all interpolated path IDs and reject `/ ? #` in IDs.
   `CortanaAi.node.ts:100-157` et al.
4. **N8N-04 (Medium, cross-repo)** — Document true minimal scopes, promote per-business/per-resource keys
   with expiry, and stop defaulting business scope to `'all'`
   (`AgentKong_App/src/lib/api/v1/scopes.ts:65-76`).
5. **N8N-05 / N8N-06 (Low)** — Move the signing secret to the encrypted store; log verification failures
   and reconcile README with actual (silent) behavior.

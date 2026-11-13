# P1.08 — REST API and Event Contract Specification

**Version:** 1.0 — **OWNER-APPROVED PROVISIONAL INTERNAL DESIGN** · 2026-11-13  
**Phase:** P1.08 — API and Event Contracts · [Issue #21](https://github.com/owaisprog/Zoho-Clone/issues/21)  
**Prerequisite:** P1.01–P1.07 owner-approved **planning/design requirements**, including P1.07 provisional domain model, **not** an implemented database.  
**State:** **P1.08 COMPLETE — OWNER-APPROVED API/EVENT DESIGN ONLY (2026-11-13)**. No API routes, Express server, Prisma schema, OIDC handler or event bus exists.  
**Authorization:** P0.10 internal **synthetic-data-only** development. No real customer data, live processor onboarding, subscription charges, pilot accounts or public production.

Machine-readable companion: [OpenAPI 3.1 draft](openapi-v1.json) (**67 operations, 44 paths, 72 schemas**), [API-to-requirement map](api-traceability.csv), [event contracts](event-contracts.md), [16-event catalog](event-catalog.csv), [event envelope JSON Schema](event-envelope.schema.json), and [164 future API acceptance cases](api-contract-cases.csv). The OpenAPI specification defines intended request/response shapes, NOT an accessible endpoint or server URL.

## 1. Major API boundaries

- **One versioned base:** `/v1` and stable operation IDs; breaking request, response and event changes require a deliberate version/migration decision. Exact public hostname is **not selected**.
- **Auth:** Managed OIDC/session is a planned integration, with a secure cookie as a design placeholder. No authentication credentials are accepted as ordinary CRM fields. Server-side session invalidation, CSRF protection and cookie attributes must be finalized and **tested** in P3/P4. Browser UI is never trusted as permission authority.
- **Organization URL:** For tenant routes use `/v1/organizations/{orgId}/...` for readability only. `orgId` is a routing hint; the server must verify an active matching membership, module entitlement, action grant, record/agent/team scope and field projection for *every* request. No "admin" or "owner" wildcard content privilege.
- **Bootstrap exception:** A verified new identity may create a **new** organization without already belonging to it, but must not claim access to an existing ID. Initial owner membership and organization creation must be atomic.
- **Resource IDs:** Opaque server-generated IDs; draft accepts safe `org_demo_*` synthetic identifiers. Final encoding (UUIDv7/ULID), uniqueness and numeric key strategy belong to P3/P4 after explicit technical review.
- **Time:** RFC 3339 UTC for API timestamps, with explicit user locale/time zone for presentation. Do not infer local timestamps or permit mutable client audit times.
- **Casing:** JSON request/response properties use `camelCase`, database columns may use `snake_case`. The mapping is not yet implemented.
- **Content:** `application/json` for modeled commands and responses. There is **no generic file upload endpoint** in the first contract, no unsafe opaque `metadata` bag, no arbitrary `PATCH /fields` behavior and no raw provider event-body accepted.
- **No direct hard delete:** Initial P1.06 permission matrix does not grant arbitrary `DELETE`. Revoke, archive or lifecycle changes are explicit business commands; legal deletion workflows are separate.
- **Billing:** Only **mock** entitlements and safe opaque provider references. No card fields, checkout/payment capture, external processor callbacks or billable actions authorized in this specification.
- **External processor:** Status references are **read-only synthetic/unverified**. A manually progressed internal stage or `DEMO_ONLY_ACTIVE` status does not mean processor approval, boarding, charges or payouts enabled.

## 2. Responses, validation and field projections

**Success shape:** Normal entity detail returns one resource object with an opaque `id`, `organizationId` when tenant-scoped and only explicitly granted fields; list shape: `{"items":[...],"nextCursor":"opaque","requestId":"..."}`. A missing `nextCursor` means no more results. Maximum page size **100**, proposed default **25**, and the cursor is opaque and tenant/query-bound. The server applies authorization *before* filtering, counting, pagination and export.

**Input handling:** Schema-defined properties only; reject unknown and prohibited fields. Business labels/next actions are short and bounded, not arbitrary uploads. Every same-org reference and active membership is checked independently; cross-tenant reference denial must not reveal whether the hidden target exists.

**Error shape:** `{"error":{"code":"SAFE_CODE","message":"Safe human-readable message","fieldErrors":{"field":"reason"},"retryable":false,"requestId":"opaque-id"}}`. `fieldErrors` optional; never echo request body, real secrets, IDs/KYC or private record names. HTTP responses by policy: `400` invalid/unknown/prohibited input; `401` expired/invalid session; `403` denied role/entitlement; privacy-preserving `404` inaccessible/missing record; `409` version or idempotency conflict; `422` invalid domain stage; `429` throttle; `503` dependency unavailable. Final per-route mapping and enumeration-resistant behavior require implementation review.

**Optimistic concurrency:** For applicable state/ownership updates, require an expected version via `If-Match` (e.g. `"3"`); conflict returns safe `409` without partial stage history. The request must not mark success until the actual transaction commits. **Idempotency-Key** is required for logical creates, invitations, stage transitions, assignments and job requests; scope it by verified org, actor, operation and request semantic fingerprint, with conflict on mismatched reuse. Key TTL and replay storage are open P3/P4 design choices.

**Policy and observability:** Unauthorized attempts generate sanitized audit with actor, org, action, outcome, time and correlation ID, never the raw request or provider message. Low-level errors and async workers obey the same record/field rules. Rate limits, quotas, payload caps, schema validation and permission changes must fail closed.

## 3. R0 Shared Platform operations

| Group | Proposed endpoints | Intended safe behavior |
|---|---|---|
| Auth/session | `GET /v1/session` | Current verified principal context only; no raw token exposure |
| Organizations | `GET/POST /v1/organizations`; `GET/PATCH /v1/organizations/{orgId}` | List authorized orgs, bootstrap new org, restricted profile |
| Members | `GET /members`, `PATCH /members/{memberId}` | Active membership and revocation; protect last owner |
| Invitations and roles | `GET/POST /invitations`, `POST /invitations/{id}/revoke`, `POST /v1/invitations/{id}/accept` (global verified invitee), `GET /roles`, `GET/POST /members/{id}/role-grants`, `POST /members/{id}/role-grants/{grantId}/revoke` | Allowlisted grants; proof of invitee email/one-time acceptance and credential security to refine in implementation; no invite secret in business response |
| Plans | `GET /entitlements`, `GET /billing-reference` | Server-authoritative mock entitlements only |
| Audit | `GET /audit-events` | Sanitized metadata; org owner/security reviewer scope only |

All paths after the organization bootstrap in this table are scoped underneath `/v1/organizations/{orgId}`. **Invitation acceptance, controlled role grants and non-member activation now have provisional OpenAPI routes.** The verified invitee identity binding, one-time acceptance proof, replay protection and permission middleware still need P3/P4 implementation and actual security tests; a draft route is not a completed flow.

## 4. R1 Sales CRM operations

| Group | Proposed endpoints | Design constraints |
|---|---|---|
| Leads | `GET/POST /leads`, `GET/PATCH /leads/{id}`, `POST /leads/{id}/transition` | Team/owner policy, sanitized contact fields and configurable stage |
| Accounts & Contacts | `GET/POST`, `GET/PATCH /{id}` | Same-tenant links and scoped field projections |
| Deals | `GET/POST`, `GET/PATCH /{id}`, `POST /{id}/transition` | Pipeline-valid stage, version conflict and audit; “won” is *not* processor approval |
| Tasks | `GET/POST`, `GET/PATCH /{id}` | Active assignee, permitted parent record and no orphan task |
| Reports | `GET /sales-reports/pipeline` | Counts of only authorized team/assigned records |
| Transfer metadata | `POST /imports`, `POST /exports`, `GET /transfers/{id}` | **Design placeholders only**; actual file upload/download unavailable until safe scanning/private export delivery approved |

## 5. R2 Merchant Operations operations

| Group | Proposed endpoints | Design constraints |
|---|---|---|
| Agents | `GET/POST /agents`, `GET/PATCH /agents/{id}` | Internal agent directory only; no external user portal |
| Merchants | `GET/POST /merchants`, `GET/PATCH /merchants/{id}` | CRM account linking within verified tenant, no KYC/bank/card |
| Agent assignment | `GET/POST /merchants/{id}/assignments` | Immediate old-portfolio revocation, consistent history |
| Applications | `GET/POST /applications`, `GET/PATCH /applications/{id}` | Internal tracking owner/next action only, not external underwriting |
| Stage policy & transitions | `GET/POST /application-stages`, `POST /applications/{id}/transitions`, `GET /applications/{id}/history` | Provisional configurable internal stages, atomic transition/history/version |
| Checklist | `GET/POST /applications/{id}/checklist`, `PATCH /applications/{id}/checklist/{checklistId}` | Non-sensitive items; no processor status grant |
| External status reference | `GET /applications/{id}/external-status-reference` | Read-only synthetic unverified provenance; no mutation route |
| Operations metrics | `GET /onboarding-reports/stalled` | Owner/internal stage/next action and tenant-safe counts |

The application states are hypotheses because **0/3 P0.05 real merchant workflows were validated**. Exact stage keys, relation shape and downstream provider semantics remain changeable before schema implementation.

## 6. Internal events, outbox and external provider prohibition

See [Internal Event Contracts](event-contracts.md). Proposed domain events are **internal-only signals**, not proof of real processor, payroll or billing success. Event envelope includes `eventId`, `eventType`, `schemaVersion`, `organizationId`, `aggregateRef`, `occurredAt`, `correlationId`, and a minimal safe reference-only payload. No card/bank/KYC, full contact records, OAuth tokens, text note bodies or processor raw messages.

**Delivery assumptions (not implemented):** Transactional outbox alongside business state/audit when relevant; at-least-once delivery, stable event ID and consumer inbox/dedup, retry/backoff and dead-letter audit. Ordering is per aggregate where applicable rather than globally guaranteed. No generic service principal with all-tenant privileges.

**Explicitly excluded event flows:** Verified provider underwriting webhooks, real card/billing callbacks, ACH/payout notifications, external agent portal messages, live KYC uploads and device provisioning. Those require new approved third-party contracts, jurisdiction/security work and separate API specs.

## 7. Traceability and acceptance conditions

- [API traceability CSV](api-traceability.csv) maps **67 proposed HTTP operations** to R0/R1/R2, PRD UC, Functional SRS FR, feature, permission and request/response schemas. **18 of 26 PRD UC** and **37 of 49 FR** have direct HTTP operations. `UC-106` (UI states) and `UC-208` (QA fixtures), plus six deferred specialist/suite UCs (`UC-301`–`UC-306`), intentionally have no live MVP endpoint. The remaining 12 FRs are cross-cutting support-denial/UX/QA or deferred provider/specialist concerns; they require explicit P1.09 test/policy traces rather than invented public routes.
- [Contract acceptance matrix](api-contract-cases.csv) contains **164 future positive/negative tests — NOT RUN** (134 per-operation and 30 cross-cutting/deferred). Tests include cross-tenant IDOR, forbidden field injections, assignment revocation, state/version conflicts, fake provider approvals and idempotency.
- **P1.09** will unify the requirements/API/events/test traceability. **P3/P4** will implement Express handlers, schema validation, Prisma transactions, permissions and an actual OpenAPI validator in CI, then record genuine run evidence.
- All performance, uptime, accessibility and security targets from P1.03 remain **design targets only**, with no measured result or certification.

## 8. P1.08 owner-review checklist

- [x] Versioned REST conventions, auth/tenant scope, input/output/error shapes and status safety written.
- [x] Machine-readable draft OpenAPI and traceability prepared with versioned R0/R1/R2 operations.
- [x] Proposed internal event envelope/correlation, outbox, ordering/idempotency and denial rules prepared.
- [x] Contract-test scenarios marked as future/unexecuted.
- [x] Product owner expressly approved P1.08 versioned REST/API, permissions/error, and internal event contracts **as provisional design, not implemented endpoints or running services** on 2026-11-13.
- [x] P1.08 issue #21 closed after design approval; P1.09 Acceptance and Traceability Map opened as issue #22.

**P1.08 COMPLETE as provisional design only.** No endpoint, event, schema migration, security control or automated contract test exists in code.

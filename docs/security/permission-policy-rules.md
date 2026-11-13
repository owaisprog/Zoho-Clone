# P1.06 — Authorization Decision Rules and Policy Engine Contract

**Version:** 1.0 — OWNER-APPROVED P1.06 POLICY DESIGN (2026-11-13)
**Prepared:** 2026-11-13
**Status:** Owner-approved **DESIGN RULES** (2026-11-13), NOT implemented RBAC, ABAC, database RLS, endpoint guards or tested security evidence.
**Source of truth:** [Permission matrix](permission-matrix.csv) and [human review](permission-matrix.md)
**Restricted operation:** Synthetic-only internal development. No live payments, real customer data, external pilot or processor integration authorized.

## 1. Authentication, active tenant and organizational bootstrap
- **Initial create-org exception:** An authenticated verified actor **not yet a member** can invoke the *separately authorized* `createOrganization` bootstrap command to create a new fictional org and atomic owner membership. It must never accept a client-selected pre-existing organization ID or grant ownership there. This bootstrap is **not** an override of role matrix for existing org resources.
- **Protected tenant actions:** Resolve principal from verified provider/session. Resolve active org from an active server-side membership record; never trust URL `orgId`, hidden form field or JWT's stale roles alone. Suspended orgs/members denied.
- **Access-changing event:** Role downgrade, removal, suspension, team/agent reassignment and subscription expiry must take effect on the next protected server request. Cache policy either invalidates promptly or validates revision/expiry against authoritative store; eventually consistent stale grants do not satisfy deny-on-next-request.
- **Session switching:** Clear old tenant-specific client cache and sensitive UI state after org switch, logout or revocation; server remains authoritative even if UI fails.
- **Last owner invariant:** Never allow removing/retiring final active owner membership without an explicitly verified replacement and authorized transfer flow.

## 2. Per-request authorization (conceptual pseudocode; NOT executable product code)

```text
authorize(request):
  actor = verifyAuthenticatedSession(request)             // fail closed
  if operation == bootstrapNewOrganization:
      requireVerifiedIdentity(actor)
      requireNoClientChosenExistingTenant()
      createOrgAndOwnerMembershipAtomically()
      return
  org = resolveActiveOrganizationFromVerifiedMembership(actor)
  assertActive(org, actor, currentMembership)
  assertAppEntitlement(org, resource.module)
  grants = loadApprovedRoleGrants(actor, org)                // no stale client role trust
  requested = resolveResourceAndAction(request)
  assertRoleActionAllowed(grants, requested)                 // DENY default
  predicate = intersectTenantTeamOwnerAgentRecordScopes(
      org, actor, grants, requested
  )
  assertReferencedParentsAlsoMatchPredicateAndTenant()
  fields = intersectFieldAllowlistAndDataClassification(
      requested, actor, predicate
  )
  rejectUnknownProhibitedFieldsAndUnsupportedUploads()
  assertSpecialBusinessRulesAndExpectedVersion()
  result = executeConstrainedReadOrAtomicMutation(predicate, fields)
  writeSafeAuditMetadataWithoutSecretValues()
  return safeProjection(result)
```

Each named function requires explicit error, transaction, concurrency and privacy design in P1.08 and P3/P4. Do not implement a naive post-query JavaScript filter for tenant access or assume "role == admin" shortcuts.

## 3. Role and record semantics
- Default `NONE` in the 286-row matrix takes precedence over missing grants; a special capability requires a separate owner-approved policy not mere condition-string manipulation.
- Users may hold more than one internal role. **Union of approved action grants** is allowed only inside **intersection of tenant, data class, organization state, record ACL, assignment, purpose and app entitlements**. No "superuser" exception appears in ordinary membership.
- `ORG_OWNER` and `ORG_ADMIN` manage account settings but do **not** automatically gain all business record read/write access; a sales/ops grant is separately required.
- Record scope is checked on every list row, ID lookup, relation join, status change, count, cached view, job and export. The authorization predicate must be applied before aggregates and search results are computed.
- Public URLs and file preview links never convey full authorization by obscurity. Expiring signed URLs need tenant/role and privacy review, and must not outlive revoked access without mitigation.
- Role assignment requires actor authority to grant **specific role** in own org; no self-grant of owner/platform/support/security reviewer roles; dual control for sensitive policies if introduced later.

## 4. Record lifecycle, agent assignment and domain boundaries
- CRM owner/team fields grant record scope only when backed by current server-side team/owner links. A user's text name matching an owner field is not an ACL.
- Agent relationship is **internal business metadata**; adding an agent does not provision an external login. Portfolio read requires active authorized agent-management relationship or separately approved onboarding team link.
- A reassignment must update relation history/audit atomically; **former portfolio visibility is denied on next request**, including direct IDs, dashboards, exports and queued jobs.
- Application stage history is created **only as a side-effect of an authorized internal stage transition**, not via a public create/update/delete stage-history endpoint.
- Checklist completion never grants processor approval. `external_status_reference` is read-only to humans in R2; in sandbox it is synthetic/unverified. Future real provider updates require approved contract + scoped service principal + signature + replay/ordering validation, none present now.
- Deletion is not an ordinary CRUD privilege in P1.06. Sensitive record deletion/retention/export requires an explicit future privacy life-cycle workflow with approvals, legal hold and audit, not hard purge by manager.

## 5. Field-level and sensitive-data policy
- **Allowlist every create/update and response projection.** Unknown attributes and bulk patch paths are denied. Never serialize entire Prisma entity into a response just because caller may read summary.
- No **raw card/PAN/CVV, bank account/routing, government identity/KYC/KYB document, processor private credentials or secret tokens** in generic CRM, CSV imports, attachments, telemetry, AI prompts or search indexes, even in demo; use safe fictional markers for negative tests.
- Sales/onboarding handoff fields can include merchant name, internal owner and permitted status/task only. Restricted private salesperson notes and sensitive contact fields must be excluded from summary projections unless explicitly granted.
- Audit fields include safe actor/action/time/outcome and opaque object references; no request bodies, full error stack or provider tokens. Read access to audit is independently scoped to `ORG_OWNER` and `SECURITY_REVIEWER` per matrix (with field allowlist).
- Export permission `E` is distinct from `R`, scoped before query, and field-level rules still apply. Generating an export may require second-factor or approval later for high-risk data; do not claim this implemented.

## 6. Error codes, privacy and resilience (P1.08 to formalize)
- `401` for invalid/missing session.
- `403` for authenticated denied action where disclosure is safe; privacy-preserving `404` when a record may be absent or forbidden. No different body/timing paths that deliberately reveal tenant existence.
- `409` for stale version, race or conflicting role/ownership transfer, with safe current info only to an authorized actor.
- `422` for unsupported state transition or a domain constraint failure.
- `429` for abuse rate limits; `503` for dependent service unavailable. Do not default a failed safety check to allow.
- Log denied privileged access with minimal metadata and correlation ID; never echo disallowed fields, raw tokens or hidden record title in error messages.

## 7. Consistency and database/worker constraints
- Scoped queries include verified tenant ID and row/team/owner/agent policy. Cross-tenant **foreign keys/relations must be validated**, not just the parent request URL.
- Prefer database constraints and transactions for membership grants, assignment, stage-history and audit/outbox changes. Database RLS is optional as defense-in-depth only when connection pooling and per-request/session tenant context are proven safe; do not claim RLS already exists.
- Background jobs and service-to-service event consumers also need a typed tenant/actor authorization context and allowed minimal fields. Never grant `SYSTEM_WORKER` all tenants just for queue convenience.
- Authorization decisions and caches should be versioned/audited so access changes immediately invalidate stale grants. Report counts, exports and search must use same policy as detail read.
- No production-grade file upload mechanism or public bucket may be assumed from docs; any future file flow requires quarantine, anti-malware scan fail-closed, access policy and deletion tests.

## 8. Design handoff / explicit unresolved questions
- P1.07: precise resource field allowlists, classification and relationship keys; tenant ID model, UUID/ID and legal retention, active team membership.
- P1.08: policy middleware, typed actor/subject/access methods, endpoint contracts, error envelope and machine principal authentication.
- P1.09: every role/resource decision and critical cross-resource denial maps to tests with real run IDs only once code exists.
- P1.10: owner reviews open risk about owner role vs delegated data read, direct exports, stage history and support JIT access.
- P2/P3/P4/P12: actual UI, backend policy enforcement, integration/E2E tests, code review and independent external-release safeguards.

**P1.06 approved and closed as design requirements.** No executable authorization or security tests have been produced; P1.07 domain glossary/field definitions are next.

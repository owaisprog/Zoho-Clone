# P1.06 — Permission and Sharing Matrix

**Project:** Zoho Clone — internal working name
**Version:** 1.0 — OWNER-APPROVED P1.06 DESIGN REQUIREMENTS (2026-11-13)
**Prepared:** 2026-11-13
**Phase:** P1.06 Permission and Sharing Matrix
**Issue:** https://github.com/owaisprog/Zoho-Clone/issues/19
**Inputs:** P1.01 owner-approved PRD, P1.02 Functional SRS, P1.03 NFR design targets, P1.04 provisional personas/journeys and P1.05 feature/release gates (owner-approved 2026-11-13).
**State:** **P1.06 COMPLETE — owner-approved least-privilege, default-deny, tenant, record and field policy DESIGN only (2026-11-13).** No RBAC/ABAC code, database RLS, APIs, user sessions or executed security tests exist yet.
**Authorization:** P0.10 conditional GO for internal **synthetic-data-only** work. No live merchant/customer data, real processor integration, external pilot or public paid production authorized.

## 1. Access principles

**Deny by default.** No client-side hiding, JWT role string, `orgId` request parameter, team title or leadership title independently authorizes business data access. Every protected operation must pass, in order, a **verified actor/session**, an **active tenant membership**, **application entitlement**, **role permission**, **record/relationship scope**, and **field/purpose policy**. The application denies and audits risky attempts safely and returns no hidden records or aggregates.

**Roles represent duties; scopes represent actual permitted rows.** A user may have multiple approved internal roles, but their cumulative action grants are **intersected with** hard tenant, record, field, purpose, data-minimization and legal restrictions. An organization owner/admin is not implicitly a sales representative, onboarding manager or identity document custodian.

**Highest-risk operations:** changes to memberships/roles/agent assignments, imports/exports, stage transitions, processor status, audits and future hosted billing callbacks require explicit policy beyond generic `update`.

The 22 resource families and 13 roles are fully specified as **286 distinct default-deny role/resource records** in [permission-matrix.csv](permission-matrix.csv). These records are proposed requirements, not actual tested permission results.

## 2. Matrix action and scope glossary

**Actions**
- `C` — Create a record/command through its specifically authorized workflow. Not arbitrary insert.
- `R` — Read permitted rows and fields with server-side filtering. Not unconstrained `SELECT`.
- `U` — Update allowed fields or execute an approved internal state transition. Does not include privilege grants, system stage-history rewrite, or external approval.
- `E` — Export explicit permitted rows/fields, requiring a separate capability and audit. General `R` is not equivalent.
- `M` — Scoped management, limited to explicitly defined grants/tenant config/agent assignment. Not a wildcard `admin:*`.
- `NONE` — No authorization. **Direct hard delete (D) is not enabled for any role**; archive, revocation, retention/deletion workflows need independent later design.

**Row scope meanings**
- `OWN_ORG` — This specific verified organization, with allowed resource/field actions.
- `TEAM_RECORDS` — Records linked to an approved team the actor is assigned to manage; no entire-tenant fallback.
- `OWN_OR_ASSIGNED_TEAM_RECORDS` — Actor-owned, explicitly assigned or policy-visible team records; subject to record ACL.
- `TEAM_LINKED_RECORDS` — Merchant/app/CRM relations whose team scope is independently permitted.
- `ASSIGNED_LINKED_RECORDS` — Merchant/app/CRM relations with an active, policy-approved assignment to the actor.
- `ASSIGNED_AGENT_PORTFOLIO` — Only the merchant links belonging to explicitly authorized internal agent portfolio relations, with immediate revocation.
- `OWN_OR_ASSIGNED_LINKED_RECORDS` — Only sales-owned and explicitly assigned merchant/account relationships, **summary fields only**.
- `AUTHORIZED_TEAM_ONLY` — Explicit team import delegation; admin title alone is insufficient.
- `DENY` — No permitted rows and no existence disclosure.

**Field scope:** `ALLOWED_*` references **field allowlists**, not all columns. `*_SUMMARY` restricts financial/underwriting/private notes; `SANITIZED_AUDIT_METADATA` forbids full payloads and secrets; `SOURCE_TIMESTAMP_VERIFICATION_SUMMARY` allows only provider-source provenance safe to show, not mutation of processor status. Precise column lists must be frozen in P1.07 Domain Glossary and P1.08 API Contracts. Fields not in allowlist are denied.

## 3. 13 actor types

| Role | Main permitted duties | Explicit exclusions |
|---|---|---|
| `ORG_OWNER` | Own-organization metadata, limited memberships/role administration, entitlements, safe audit view | **No blanket CRM/merchant row read**, no processor approvals or finance raw data |
| `ORG_ADMIN` | Safe organization profile settings, allowlisted membership invitations/role grants, entitlement view | Cannot grant `ORG_OWNER`, `PLATFORM_SUPPORT`, `SECURITY_REVIEWER` or access arbitrary business records by title |
| `SALES_MANAGER` | Team lead/contact/account/deal/task CRUD, permitted reports and authorized export | No unrelated teams/tenants or merchant processor edit |
| `SALES_REP` | Own/assigned-team lead/contact/account/deal/task work and explicitly authorized export | No global customer directory, no other team's reports |
| `ONBOARDING_MANAGER` | Team merchant cases, internal stages/checklists, authorized summaries and dashboard | No actual processor underwriting, payouts or raw KYC/bank |
| `ONBOARDING_COORDINATOR` | Assigned/linked merchant applications, internal next actions and checklist | No unconstrained company-wide merchant access or external provider status update |
| `AGENT_MANAGER` | Internal agent directory/portfolio assignments, related merchant summaries and audits | No external agent login, no raw merchant identity info |
| `BILLING_ADMIN` | Own org subscription/plan/reference metadata (mock in sandbox) | No raw cards/banks, CRM/merchant records or unverified payment success |
| `SECURITY_REVIEWER` | Safely redacted authorization/audit metadata, limited stage provenance | No full CRM contents, no secret dumps or self-service privilege grants |
| `PLATFORM_SUPPORT` | **No tenant business data by default** | Any future JIT/consented support access is separately designed, approved and audited |
| `EXTERNAL_AGENT` | **NONE in initial MVP** | Deferred external agent portal, no internal account |
| `EXTERNAL_MERCHANT` | **NONE in initial MVP** | Deferred merchant portal/KYC, no generic CRM verification upload |
| `SYSTEM_WORKER` | **NONE by default** | Future integration service principals must be individually scoped, authorized, auditable and contractually enabled |

A user can hold approved internal sales and onboarding roles simultaneously. Combined grants must not violate record scope, tenant boundary or field classification. Admin/owner privileges alone are deliberately not broad data-read privileges.

## 4. Resource groups and ownership rules

| Release | Resource | Key boundary / operation |
|---|---|---|
| R0 | Organization, memberships, invitations, role grants | Active org membership; protect last owner, role assignment allowlist, invitation secrecy |
| R0 | App entitlements, billing references | Server-authoritative plan status; mock billing only; no raw card/account info |
| R0 | Audit events | Read sanitized actor/target/action/time; append automatically via authorized workflow, no user rewrites |
| R1 | Leads, contacts, accounts | User/team record scope; no cross-tenant ID links, sensitive fields or global lookup |
| R1 | Deals, tasks, activities | Ownership and valid relation/transition; no silent lost updates |
| R1 | Sales reports | Filter by permitted rows **before** aggregate; no team-count side channels |
| R1 | Import jobs | Allowlisted synthetic CSV; exact allowed columns/role and file security before implementation |
| R1 | Export jobs | Additional `E` permission, explicit row/field selection, audited and expiring delivery |
| R2 | Agents, merchants, merchant applications | Team/agent/assignee relational access with current linkage and version checks |
| R2 | Stage history and checklists | History append-only as outcome of an approved action; checklist never authorizes external state |
| R2 | External status references | READ-ONLY synthetic/provenance metadata; real provider write adapter not authorized |
| R2 | Onboarding dashboard | Authorized rows aggregated, no side-channel counts or cross-agent inventory |

## 5. Sharing and delegation policy (draft)

**Initial model: PRIVATE by default** for lead, contact, account, deal, merchant and application records. Assignment or explicitly approved team grants may expand read/write scope; it must always stay inside the same active organization. A single organization can have multiple teams and roles, but **no cross-tenant record sharing** or public sharing of business records is permitted by R0/R1/R2.

**Team assignment:** a sales manager accesses only teams that policy grants them; a sales rep receives assigned/owned records. An onboarding coordinator's access is tied to live case/merchant assignments. Inactive, revoked and future external identities are not eligible for internal record sharing.

**Agent relationships:** `agent_record_id` is internal CRM metadata, not an authenticated external agent. An `AGENT_MANAGER` receives only authorized portfolios; reassignment must invalidate prior derived visibility on **the next server request**, preserving history for authorized reviewers.

**Field-level:** summary role views must never include arbitrary free-text notes, KYC documents, raw card/bank fields, provider event bodies, customer export URLs or other sensitive fields. Every computed export, report and audit snapshot inherits field policies; masked fields cannot be retrieved by guessing a REST route or changing GraphQL/query parameters.

**Owner/admin special cases:** protect the last active owner, prevent an administrator granting stronger roles than their allowed role-assignment policy, and require audited intentional changes; tenant owner does not automatically grant itself unrestricted processor, finance or secret access.

**Support and service principals:** no default cross-tenant support impersonation. A future break-glass or provider webhook flow requires an explicit designed consent/justification, timebound scope, secret management, least privilege, auditing and independent validation. It is **not included in the current permission matrix as allowed access**.

## 6. One concrete access example

Fictional tenant **Orchid Payments Demo** has sales rep Ada and onboarding coordinator Sam; tenant **Juniper Merchant Services Demo** has another org owner.

- Ada may read an Orchid deal only if it belongs to Ada's allowed owned/assigned team scope and is granted to her sales role. She cannot see the Juniper deal by changing its ID.
- Sam may read an Orchid merchant application only while assigned to the relevant case/team and with merchant app entitlement; Sam may change approved internal checklist fields but cannot mutate external processor verification status.
- A user with only `ORG_OWNER` can manage own org membership and plan metadata but does not get an unrestricted list of Orchid merchants. To read cases they need a separately approved onboarding role/grant.
- An external agent cannot sign in to an internal merchant portal based solely on an Agent table record. The external portal is deferred.
- An expired or revoked member cannot reuse a previously rendered record URL or a queued export to retrieve data.

All examples are **fictional**. No system currently enforces them.

## 7. Authorization decision procedure

See [permission-policy-rules.md](permission-policy-rules.md) for detailed decision order, safe responses, cache/revocation and relation rules. Summary:
1. Authenticate actor/session and active organization membership; verify account state.
2. Check module/app entitlement for that organization, then role permission for requested verb/resource.
3. Determine row/relationship scope **as a database predicate** (rather than fetching broadly then hiding results).
4. Confirm record's organization and all related records' organization match verified context.
5. Restrict field projection/write allowlist, classify data, and reject forbidden raw fields/unknown input.
6. Enforce domain constraints, expected version, rate limits, idempotency and special approval rules.
7. Commit authorized changes and safe audit/state-history atomically where applicable.
8. Return privacy-preserving errors without leaking whether a hidden record exists.

**Server checks are mandatory.** The UI should also hide irrelevant commands, but UI visibility never replaces authorization.

## 8. Concrete denial/verification scenarios

The companion [permission-negative-cases.csv](permission-negative-cases.csv) lists future tests for:
- Cross-org IDOR, relationships, search, exports and aggregate counts.
- Unauthorized role grant, last-owner revocation, stale/expired membership and plan bypass.
- Agent reassignment invalidating old visibility and malicious/stale task links.
- Internal stage history immutable from direct CRUD, external processor state not writable by staff.
- Financial/identity/card/KYC field injection through forms, imports, telemetry and exports.
- Billing events denied without authorized provider adapter and verified signature.
- System/support actors unable to cross tenant boundaries by default.

**Every test is `NOT_RUN_DOCUMENT_ONLY`**, not evidence of a safe product.

## 9. Traceability and handoff

- Core requirement sources: `FR-001..FR-011` tenant/org/access/billing, `FR-012..FR-026` sales and `FR-027..FR-043` merchant workflows and security.
- Feature sources: `FT-002` organization switching, `FT-003` invitation, `FT-004` tenant/record policy, `FT-005` audit, `FT-019` agent assignment, `FT-025` reassignment revocation, `FT-026` external status separation and `FT-036` hard security gate.
- P1.07 defines final domain glossary/field allowlists, P1.08 defines API request/result/access contracts, P1.09 links denial tests, P1.10 resolves policy risks.
- P3/P4 implement **real** authorization and test with two isolated fictional tenants. P12 supplies later security evaluation and release evidence.

## 10. P1.06 exit

- [x] 13 actors and 22 resource families defined; **286** proposed role/resource rules in CSV.
- [x] Deny-default, active membership, entitlements, row/field policy, sharing and forbidden-data restrictions articulated.
- [x] Platform support/external agents/external merchants/machine principals have no implicit access.
- [x] Future negative-access matrix and implementation handoff written.
- [x] **Product owner approved** all proposed least-privilege roles, default-deny access, tenant/record/field sharing rules and hard denials **AS DESIGN REQUIREMENTS, not implemented security controls**, on 2026-11-13.
- [x] P1.06 issue #19 closed after owner approval; P1.07 Domain Glossary and Synthetic Sample Records started in issue #20.

**Status:** P1.06 **COMPLETE — APPROVED DESIGN BASELINE ONLY**. No permission code or verification runs exist. Research about ISO/POS/PayFac roles and real workflows remains outstanding in issue #8.

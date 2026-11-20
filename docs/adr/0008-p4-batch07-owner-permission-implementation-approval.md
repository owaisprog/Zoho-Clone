# ADR 0008 — P4 Batch 07 authorization implementation details

**Decision date:** 2026-11-20
**Status:** **OWNER APPROVED — INTERNAL SYNTHETIC-ONLY IMPLEMENTATION DETAILS** (not release/security acceptance)
**Authority:** Explicit product-owner message approving **D1, D2, D4, D5** as written in [Batch 07 decision review](../security/p4-batch07-permissions-owner-review.md).
**Preceding requirements:** [ADR 0007](0007-architecture-v1-owner-approval.md) and the previously [owner-approved P1.06 286-row matrix](../security/permission-matrix.csv). This ADR adds no production authorization or P4 exit signoff.

## Approved decisions — exact scope

- **D1 — Private by default:** New CRM leads start `private`. Current ownership, explicit direct assignment or deliberately enabled same-tenant team sharing may permit access. Merely belonging to a team does **not** reveal its private records.
- **D2 — Sales-manager and representative scopes:** A `SALES_REP` may read owned, explicitly assigned or explicitly team-shared CRM records within teams of which they are an active member. A `SALES_MANAGER` may read explicitly shared CRM records only of teams they are currently authorized to manage. Job title/owner status alone never authorizes cross-team records.
- **D4 — Initial safe fields:** Read-only synthetic `leads.R` projects only `id` and `displayName`. Exclude confidential notes and sensitive fields from API and database runtime SELECT grants; full P1.07/P1.08 field specification remains to be verified separately.
- **D5 — Immediate authorization revocation and bounded operations:** On each protected request/transaction, recheck current active organization membership, business role, app entitlement, team relationship and explicit assignment/share link. Downgrade, deletion or expiry denies the next read. Export requires its own `E` permission and workflow. Create/update/manage/deletion, transfers and cross-tenant sharing remain disabled until separately approved and tested.

**Preserved existing design (D3, not a new approval):** `ORG_OWNER` and `ORG_ADMIN` are **not** automatically allowed to read CRM data. A separately authorized sales role and applicable record/field policy must permit access. Preserve P1.06's **13 roles, 22 resource families, 286 combinations**; do not substitute the older CI-only `OWNER/MEMBER` fixtures as production permissions.

## Engineering authorization and safeguards

May implement typed policy checks, read-only Prisma projections, SQL FORCE RLS simulations, fake roles/orgs, synthetic test-only Express routes and negative cases solely on the **disposable GitHub CI database**. In particular, new code must not mount a customer-facing endpoint through `backend/src/app.ts`, let browsers assert membership/roles, or apply CI SQL to owner Neon.

## Deliberately OPEN

- The historical **OPEN-003** decision remains **OPEN** for complete role-grant workflows, all resource/action and field lists, high-risk transitions, true customer ACLs, independent acceptance tests, audit and staging security. Approval D1/D2/D4/D5 is a *partial implementation policy decision*, not closure of OPEN-003 or P4.
- The original **12 tracked decisions, 14 original risks and 727 unexecuted P1.09 acceptance cases** remain tracked as OPEN. The 286 P1.06 entries stay APPROVED_DESIGN only, not complete executable P4 coverage.
- Real Auth0 sessions/JWKS/MFA/revocation, private object storage/quarantine/scanner, outbox workers, hosting/storage provider, data region and retention, backup/rollback and all remaining P2/P3/P4 gates remain open.
- **NOT authorized:** Neon SQL candidate execution (004–014), customer data, spending, staging or production deployment, merge to `main`, live file/download APIs, paid pilot or launch.

## Implementation traceability

- Design matrix: `docs/security/permission-matrix.csv`; typed source mirror: `backend/src/platform/p4-r7-approved-policy-matrix.ts`.
- Provisional engine: `backend/src/platform/p4-r7-authorizer.ts`.
- SQL CI isolation candidate 013: `backend/db/candidates/013_p4_r7_approved_permission_rehearsal.sql`, test 013; these test cases do **not** count toward the original P1.09 suite.
- Further approved implementation may extend only synthetic and CI-only role/relation and field tests; record actual run links in the engineering ledger.


## Synthetic-only engineering verification (2026-11-20)
Under the approved D1/D2/D4/D5 scope, the team implemented read-only Prisma and test-only Express queries for P1.06 business roles using disposable `p4_r7_ci`. [Run #44766524774](https://github.com/owaisprog/Zoho-Clone/actions/runs/44766524774) **4/4 CI jobs and 269/269 automated tests passed**, plus real PostgreSQL/HTTP revocation, private field and owner-no-CRM checks. [Full Batch 08 report](../engineering/p4-exit-integration-batch-08.md). **No additional owner permission approval is implied**; the remaining P4 release and OPEN-003 scope are still OPEN.


## Phase 4 synthetic search/report and audit rehearsal (2026-11-20)
The approved D1/D2/D4/D5 rules now also guard CI-only bounded CRM search and visibility reporting. A **separate disposable CI-only audit trigger** demonstrates transactional role/team revocation records; **it does not constitute approval for business role-management writes, delegated permissions or a production audit ledger**. [Actions #44769982822](https://github.com/owaisprog/Zoho-Clone/actions/runs/44769982822) passed 277 synthetic unit/script tests and the PostgreSQL/HTTP checks. See [Batch 09 report](../engineering/p4-exit-integration-batch-09.md). OPEN-003 and all Phase 4 security/release gates remain OPEN.

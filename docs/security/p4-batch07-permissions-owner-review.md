# Zoho Clone — P4 Batch 07 permission implementation choices for owner approval

**Date:** 2026-11-20
**Review status:** **PROPOSED IMPLEMENTATION DETAILS — OWNER APPROVAL REQUESTED**, not a re-opening of P1.06 or a production release.
**Source of truth:** [P1.06 owner-approved 286-row matrix](permission-matrix.csv), [P1.06 human policy](permission-matrix.md), [policy decision procedure](permission-policy-rules.md); [original 225-page Express roadmap P1.06, P4.12–P4.15].
**Read this first:** The P1.06 **DESIGN** already received owner approval 2026-11-13. It includes exactly **13 roles × 22 resource families = 286 action/resource decisions** and is NOT a generic four-level Owner/Admin/Manager/Member hierarchy. This document asks only for approval of **new concrete implementation choices and unresolved policy details**. Existing OPEN-003 fine-grained semantics, 14 risks, other 11 tracked open decisions and all 727 original P1.09 cases remain open until separately accepted.

## A. Preserved 13-role design baseline

The table below is a *summary*. For all 286 exact resource/action/scope/field combinations, the already-approved CSV above remains normative.

| P1.06 role | Permitted scope (subject to verified identity, active org, app, record/field rules) | Do NOT grant merely because of the title |
|---|---|---|
| \`ORG_OWNER\` | Own-org settings, limited memberships/invites/role management, entitlements, sanitized audit | **No blanket CRM, deals, merchant/agent portfolios or raw finance** |
| \`ORG_ADMIN\` | Scoped org profile, approved membership invitations and restricted role grants | No owner/platform/security role escalation, no implicit CRM or audit |
| \`SALES_MANAGER\` | Only permitted managed-team CRM records, workflow operations and permitted reports/exports | No unrelated teams, company-wide CRM inventory or cross-org reads |
| \`SALES_REP\` | Own and directly/explicitly team-assigned sales records and separately approved sales exports | No blanket company records or other-team data |
| \`ONBOARDING_MANAGER\` | Scoped internal merchant cases/checklists and safe operational summaries | No processor approval, raw KYC/bank or external status manipulation |
| \`ONBOARDING_COORDINATOR\` | Assigned internal merchant applications/checklists and safe next steps | No whole-tenant merchant inventory or processor-state writes |
| \`AGENT_MANAGER\` | Approved internal agent directory, assignment and linked merchant summaries | No external agent login or private merchant identity documents |
| \`BILLING_ADMIN\` | Own-org mock billing reference and plan metadata | No raw card/bank details, CRM contents or simulated-success spoofing |
| \`SECURITY_REVIEWER\` | Sanitized audit/authorization metadata and approved provenance references | No raw CRM contents, secrets, payment payload or self-grants |
| \`PLATFORM_SUPPORT\` | **NONE by default**; separately consented/JIT support not part of this release | No cross-tenant impersonation or break-glass access |
| \`EXTERNAL_AGENT\` | **NONE in MVP** | External portal deferred |
| \`EXTERNAL_MERCHANT\` | **NONE in MVP** | External portal/KYC deferred |
| \`SYSTEM_WORKER\` | **NONE by default** | Future service principals separately typed and scoped |

**Actions:** P1.06 \`C,R,U,E,M\` are distinct; **direct hard delete is never granted**. The SQL/TS Batch 07 proof implements **R only for synthetic leads**, plus a pure helper for safe org/audit projections. Matrix-approved create/update/export/management actions remain disabled until their own workflows, audits and acceptance tests exist.

## B. Proposed detailed decisions to approve

| Decision | Implementation proposal | Current evidence / consequence |
|---|---|---|
| **D1. Default private and sharing** | Every CRM lead is \`private\` initially. Mere membership in the same team is **not** record access. Add access only by current owner, explicit direct assignee, or explicitly enabled team sharing. | \`p4-r7-authorizer.ts\` and disposable \`p4_r7_ci\` RLS; finer P1.06 sharing semantics **OPEN for approval** |
| **D2. Sales manager vs rep** | \`SALES_MANAGER\` may read an **explicitly shared** record of a team they **currently manage**. \`SALES_REP\` may read owned, explicitly assigned or explicitly team-shared records of a team they currently belong to. Manager title alone never grants other teams' records. | Synthetic owner/rep/manager fixture, team status revocation test |
| **D3. Owner/admin business access** | \`ORG_OWNER\` and \`ORG_ADMIN\` alone do not read CRM. A separately verified \`SALES_MANAGER\` or \`SALES_REP\` business role is required. Multiple roles combine allowed actions but tenant, record and field restrictions still apply. | **Already required by P1.06**; legacy \`p4_v1_ci\` OWNER/MEMBER demo routes are explicitly **not** final authorization |
| **D4. Field allowlist** | Early synthetic \`leads.R\` returns only \`id\` and \`displayName\`. SQL role cannot SELECT \`confidential_note\`. No email, phone, private notes, bank/card/KYC, raw object keys, free-text activity or hidden fields. Org/audit safe fields are separate and require role-specific grants. | Provisional least-privilege selection, **not** complete P1.07/P1.08 final field contract |
| **D5. Revocation + action safety** | Active membership/role, app entitlement, team assignment and direct-share linkage rechecked **on each protected request/transaction**. Revocation must deny the *next* read. Exports require explicit \`E\` and new workflows; writes \`C/U/M\`, deletes and cross-tenant sharing remain off until separately accepted. | Real disposable RLS tests and pure 286-row policy tests; future cache/session/worker revocation tests required |

## C. Five Batch 07 implementation slices

1. **Matrix fidelity:** \`backend/src/platform/p4-r7-approved-policy-matrix.ts\` generated from exact approved [286-row CSV](permission-matrix.csv). No role/action/scope is invented or silently elevated. Source-fidelity tests fail if approvals and generated policy diverge.
2. **Role engine:** \`backend/src/platform/p4-r7-authorizer.ts\` consumes all 13 roles and 22 resources but only allows **a narrow, explicitly implemented read subset**. Other designed actions/resources remain denied until their implementation is approved.
3. **Team and record ABAC:** Pure engine intersects tenant UUIDv4, current org, business-role action, CRM entitlement, current team grant and explicit share/ownership/assignment. A parallel disposable PostgreSQL schema \`p4_r7_ci\` enforces a matching synthetic lead read pattern, avoiding an unsafe rewrite of earlier legacy demo fixtures.
4. **Field-level security:** Safe-lead projection enumerates only \`id\`/\`displayName\`; restricted PostgreSQL role lacks \`confidential_note\` SELECT and has no DML grants.
5. **Security tests:** \`backend/test/p4-r7-policy-matrix.test.ts\` checks exact 286 source decisions, unapproved scope default denial, owner/admin/support/external denial, lead/field sharing, multi-role intersection and unsafe operations. \`backend/db/tests/013_p4_r7_approved_permission_rehearsal.sql\` confirms actual RLS behavior in **GitHub CI only**.

## D. Unresolved decisions not silently approved

- **OPEN-003:** Final multi-role assignment delegation, sales manager team eligibility, direct share/record state, field classification and explicit export permissions need owner approval and independent test review.
- **P1.07/P1.08:** Precise contact/account/deal/merchant field lists, API authorization/audit contracts, all resource relations and resulting UI need further work.
- **P4.12–P4.15:** Public role/team CRUD, immutable reserved-role rules, last-owner invariant, audited reassignment, full background jobs and provider-scoped access need real implementation.
- **P3 staging, Auth0, storage, region, retention, vendor spend:** None approved for deployment. Current role/record proof does NOT verify real Auth0/MFA/revocation or cloud storage.
- **P1.09, P4 formal exit:** Existing 727 planned original acceptance cases remain **unexecuted**; CI tests from this batch do not count as them. P4 needs two complete isolated staging org workflows, independent negative security review and owner signoff.

## E. Owner decision requested

Please decide whether to approve **D1, D2, D4 and D5 as provisional implementation semantics** for continuing internal, synthetic-only P4 development. **D3 is a preserved existing P1.06 requirement**, not a new policy vote. If any detail needs changing, state the decision ID and preferred behavior.

**Approval, if granted, would not authorize:** editing existing live customers or owner Neon, staging/production deployment, paid cloud, merging PR #55 to main, real Auth0 or storage activation, P4 closure, original acceptance signoff or final commercial field policy. Keep issue #61 open.

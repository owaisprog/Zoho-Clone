# Phase 4 Batch 10 — Proposed Role and Team Change Authorization Contract

**Date:** 2026-11-21 (Pakistan local)
**Decision status:** **AWAITING OWNER REVIEW — NOT APPROVED FOR EXECUTABLE OR CUSTOMER WRITES**
**Grounded in:** [P1.06 owner-approved matrix](permission-matrix.csv), [P1.06 authorization rules](permission-policy-rules.md), [ADR 0007](../adr/0007-architecture-v1-owner-approval.md) and [ADR 0008](../adr/0008-p4-batch07-owner-permission-implementation-approval.md). These already approve a limited design and internal synthetic D1/D2/D4/D5 testing, **not** full delegated permissions.
**Code:** `backend/src/platform/p4-r10-ci-change-policy.ts` is a **pure decision-only helper**. `backend/db/candidates/015_p4_r10_ci_change_replay_and_owner_guard.sql` is a **disposable GitHub CI simulation using a bootstrap superuser**, and not an approved production migration or writer. No HTTP endpoint exposes it.

## P1.06 baseline that must remain unchanged

- Preserve all **13 roles, 22 resources and 286 default-deny role/resource decisions** in the existing P1.06 matrix. Multiple roles may combine only their approved actions within the tenant, record and field boundaries.
- `ORG_OWNER` and `ORG_ADMIN` **do not inherit blanket CRM visibility**. Role management `M` is separately scoped and not `admin:*`.
- Owner/administrator invitations and role grants must be allowlisted. No grants of `ORG_OWNER`, platform/support/security roles, self-escalation or nonconsensual owner transfer through an ordinary permission editor.
- The final active owner cannot be removed without verified replacement and separately approved transfer. Ordinary hard deletion, unbounded exports or audit-log rewrites remain disabled.
- P4's actual production writer identity, manager-delegation rules, complete field-contract, audit security review, event delivery and P1.09 acceptance remain **OPEN**.

## Five new implementation questions for explicit owner approval

| ID | Proposed behavior for a **future** production permission editor | What today's code does |
| --- | --- | --- |
| **R10-C1 — Who can execute changes?** | For an initial live release, only a **currently authenticated, active `ORG_OWNER`** may toggle an already existing `SALES_REP` or `SALES_MANAGER` grant in their own organization; `ORG_ADMIN` delegation and new grants stay disabled pending a further policy review. Require a fresh server-side lookup, never JWT/client role claims. | Pure CI evaluator proposes this only; candidate 015 uses one fictional CI owner to test it. No real endpoint |
| **R10-C2 — Team changes** | Owner may activate/deactivate an existing team grant for an active member of that org; **cannot add arbitrary team members, transfer teams, alter `managed` flags or move rows across orgs** without a separate approved workflow. | CI test uses a fixed existing team link and SQL FK + actor tenant context |
| **R10-C3 — Last owner** | Owner grant/membership removal must use a **separately authorized verified replacement transfer**, subject to concurrency control and audit; ordinary role/team workflow must categorically deny owner changes. | Pure evaluator always denies owner transfer; candidate 015's CI trigger denies owner role and owner membership revocation. Final secure transfer design **NOT implemented** |
| **R10-C4 — Atomicity/replay/audit** | Server must check current grant `active` and monotonic `revision` in a transaction; require a unique UUIDv4 idempotency key and fail on changed replay payload; atomically write minimal audit (opaque IDs, kind, before/after, request ID, time) with update. Revocation must affect the **next** protected read. | Real disposable PostgreSQL verifies one command/one audit, exact replay no extra audit, stale versions denied, rollback removes all related events. Audit schema is CI-only |
| **R10-C5 — Production security and responses** | Never run a privileged CI bootstrap identity in staging/production. Use separately approved least-privilege writer, verified Auth0 identity + MFA decisions, scoped RLS, secure error statuses, abuse limits, backup/restore, audit review and independent security acceptance **before** mounting real routes. | Runtime `p4_v1_ci_runtime` has no CI command/audit grants; no real writer, public route, worker or live storage created |

## Draft minimal change audit contract

A future audit event should include **only** opaque organization ID, actor ID, target-user ID, action kind (`role_grant` or `team_grant`), approved target code/team UUID, prior and next active state, expected prior revision, unique request ID and server timestamp. The event must never include JWT/refresh token, email, CRM contents, KYC, private notes, source IP without separate classification, secrets, request bodies or payment information. Accessible audit metadata and retention are independent owner decisions.

**Live failure behavior to review:** 401 for invalid signed identity, 403 or privacy-preserving 404 for unauthorized scoped actions, 409 for conflicting role state or reused idempotency key with changed content, and 503 if the mandatory audit cannot be persisted. No partial success without audit and no detailed forbidden object existence feedback.

## Explicit decisions still open

1. Whether an `ORG_ADMIN` may change **any** grant, and precisely which ones.
2. Whether owners can delegate `SALES_MANAGER` and team-manager authority and what additional checks apply.
3. Who authorizes owner transfer, whether MFA/dual control is required, and how invite/recovery flows preserve the last-owner invariant.
4. Audit store ownership/immutability, data region, retention, support access, backups, and independent review.
5. API event/endpoint contracts and production database roles; P1.09 test mapping across the full 286-row policy.

All five **R10-C1–C5 are proposals**, NOT new owner-approved commercial policy. The existing D1/D2/D4/D5 approval remains valid for synthetic-only read/permission tests. No exact provider, retention, production hosting or paid usage has been selected.

## Owner response requested

Review R10-C1–C5; approve only if these are the desired **future permission-change contract**. A yes to this document should still be interpreted as **policy-design approval only** unless you separately authorize real deployment, migrations, a non-CI writer or handling customer data.

**Never execute candidate 015 on the owner's Neon or staging/production.** Keep [draft PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55) unmerged and [P4 exit issue #61](https://github.com/owaisprog/Zoho-Clone/issues/61) open. All 14 original risks, 12 tracked decisions (including OPEN-003), and 727 original unexecuted P1.09 tests remain open.

# P4 architecture v1.0 — owner approval and internal implementation checkpoint

**Date:** 2026-11-20
**Owner decision:** Architecture v1.0 approved for internal development and Phase 4 staging **preparation only**.
**Source of authority:** Explicit owner ChatGPT message, 2026-11-20; [ADR 0007](../adr/0007-architecture-v1-owner-approval.md), master Express roadmap pp. 30–39, 193, 210–216.
**Branch:** `feat/p4-identity-org-foundation-batch-01-20261120`, draft [PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55), targeting unmerged P3 branch.

## Implementation slices

| Slice | Code evidence | Safety / remaining gate |
| --- | --- | --- |
| 1. Architecture approval and decisions | `docs/adr/0007-architecture-v1-owner-approval.md`, updates to ADRs 0001–0006 and P1 decision register | Design approved, 12 tracked decisions still OPEN for partial acceptance and other unresolved items |
| 2. Approved opaque IDs | `backend/src/platform/p4-approved-uuid.ts`: canonical UUIDv4 parsing and server ID generator, separate Auth0 issuer/subject reference, scoped ID pair | Existing `user_demo_*` fixtures remain synthetic; physical user UUID migration, composite FKs and production role not approved |
| 3. Runtime UUID enforcement | `backend/src/platform/p4-platform-read-model.ts` now uses canonical UUIDv4 checks in the restricted synthetic RLS read path | CI-only role and schema, not public/API or production/staging migration |
| 4. Private file quarantine | `backend/src/platform/p4-approved-file-workflow.ts`: synthetic metadata-only quarantine -> clean/reject and soft-delete proposals; rejects foreign actor/org, invalid state, stale version and missing scan attestation | **No provider, file bytes, signed grant, storage calls, real delete/restore or mutation**; scanner/retention/provider approval OPEN |
| 5. Transactional outbox planning | `backend/src/platform/p4-approved-outbox.ts`: typed, allowlisted metadata-only internal event plan, UUIDv4 keys, bounded idempotency and revisions | **No database writes, Redis/BullMQ dispatch, email, retries or live worker** until future owner-approved implementation phase |

## Verified checks

- [GitHub Actions #44737381948](https://github.com/owaisprog/Zoho-Clone/actions/runs/44737381948): **4/4 jobs passed**.
- Automated suite: **226/226 passed** (**58 frontend, 155 backend, 5 shared, 8 script**).
- Original P4 restricted-role PostgreSQL isolation and two synthetic organization checks continue to run in disposable CI. No SQL candidate applied to Neon or any real customer DB.
- New test file: `backend/test/p4-architecture-v1.test.ts`, including invalid UUID formats, trust-boundary projections, cross-org file checks, scan proof/revision negative cases, denied premature deletion, disabled live operations and outbox input minimization.
- One prior provisional CI run (#44737292870) failed a new TypeScript test-property typo; corrected in commit `c74285b`. **The cited #44737381948 run passed all checks.**

## Approval remains restricted

This is an **internal architecture/design approval**, not P4 acceptance or signoff on individual live integrations. No real data, staging/production deployment, paid cloud, applying candidates 004–009 to Neon, merge to main, file/worker customer access or closed security gates. Storage provider, Node hosting, region/residency, retention, malware scanner, stage environment, migration design and independent security review are pending separate decisions.

P2.02 UX information architecture, P3 staging/rollback, P4 verified Auth0 MFA/revocation, real RBAC/ABAC, staging RLS migration, files, audit and two-organization acceptance remain OPEN. All 14 original risks, 12 tracked decisions, and 727 original P1.09 planned cases stay OPEN. Follow [P4 exit checklist #61](https://github.com/owaisprog/Zoho-Clone/issues/61) and [existing P4.21–P4.25 acceptance issue #60](https://github.com/owaisprog/Zoho-Clone/issues/60).

## Next internal implementation choice

After design acceptance, build an explicit reviewed physical UUIDv4 schema and migration rehearsal **in disposable CI only**, then test final RLS policies with a separate runtime role. Do not copy the `p4_synthetic` candidate to Neon without an independent owner-authorized migration/staging decision. Storage and worker provider adapters remain disabled until separate owner choice.

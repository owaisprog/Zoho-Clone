# P4 integration-hardening Batch 10 — proposed role/team change policy, owner invariant and CI audit replay

**Date:** 2026-11-21 local (GitHub CI event dated 2026-11-20 UTC)
**Approval scope:** Existing architecture/ADR 0007 and ADR 0008 **synthetic-only** internal implementation. **R10-C1–C5 pending owner review**, not granted by the instruction to continue.
**Branch/PR:** `feat/p4-identity-org-foundation-batch-01-20261120`, [draft PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55); `main` untouched.
**Source:** P1.06 13 roles × 22 resource families = 286 design decisions. `ORG_OWNER` alone does not authorize CRM access.

## Five implemented internal steps

| Step | Implemented artifact | Real CI boundary |
| --- | --- | --- |
| 1. Delegation contract and review | `backend/src/platform/p4-r10-ci-change-policy.ts` accepts only a verified, active server-resolved same-org OWNER, existing synthetic sales-role/team toggle, and a fixed minimal audit proposal | **Decision-only pure function.** No mutation, HTTP, JWT, customer login or async job |
| 2. Reserved roles and last-owner safeguards | Same module denies owner/platform/security changes, self-modification, cross-tenant/member, stale team-management changes; `mayDeactivateOwnerMembership` always denies until a separately reviewed transfer flow | Formal owner-replacement verification and safe concurrency **NOT** implemented in production |
| 3. Versioned/idempotent CI command rehearsal | `backend/db/candidates/015_p4_r10_ci_change_replay_and_owner_guard.sql` creates separate `p4_r10_ci` schema, monotonic revisions on fictional grants, command-log deduplication and a CI-only guarded transaction using a fixed bootstrap principal; owner membership/role trigger denies removal | Command function is **not granted to tenant runtime**. Never migrate candidate 015 to Neon/staging/production, never mount a write endpoint |
| 4. SQL security and audit tests | `backend/db/tests/015_p4_r10_ci_change_replay_and_owner_guard.sql` asserts last-owner denials, exact duplicate replay without extra event, conflicting replay and stale version rejected, revoked role/team access on next RLS request, protected audit and command logs, wrong actor/tenant denied, transaction rollback atomicity | Actual PostgreSQL service **only** inside disposable GitHub CI |
| 5. Unit tests, workflow and owner review | `backend/test/p4-r10-change-policy.test.ts` adds 8 negative/positive decision-only cases; GitHub workflow runs candidate 015 and tests after 014; [owner review R10-C1–C5](../security/p4-batch10-role-team-change-contract-owner-review.md) prepared | No production permission editor, new role grants, account access or real data |

## Verified implementation CI evidence

[GitHub Actions #44832334505](https://github.com/owaisprog/Zoho-Clone/actions/runs/44832334505): **4/4 jobs PASSED** with **285/285 automated tests**:
- Frontend 58
- Backend 214 (8 new tests over Batch 09's 206)
- Shared demo contracts 5
- Safety scripts 8

Also successful: real disposable PostgreSQL `015` candidate and tests printing `P4 R10 CI-only owner guard, idempotent command, stale-version denial, atomic audit and rollback PASS`, and previously established P4 tenant/Prisma/HTTP smoke tests.

**Intermediate fixes:** CI discovered and corrected a TypeScript literal-array `includes` issue and a shared trigger trying to access a role-only column on a membership row. Both were fixed before the green [run #44832334505](https://github.com/owaisprog/Zoho-Clone/actions/runs/44832334505).

## What these checks do NOT prove

- No real Auth0/JWKS/MFA, security-reviewed permission change or production least-privilege writer. SQL candidate 015 runs using a disposable CI bootstrap superuser and is NOT production architecture.
- No production owner-transfer implementation; demonstration explicitly refuses owner changes, including when another owner may exist.
- No safe customer role-manager endpoint, full 286-decision executable matrix, complete record/field/write policies, worker events or immutable external audit system.
- No private file storage/scan/quarantine provider, region, retention, backup/restore, staged two-org full identity/access/file/audit acceptance, or owner P4 exit signoff.
- The original **14 risks**, **12 tracked decisions** (including OPEN-003), and **727 original unexecuted P1.09 cases** remain OPEN; these 285 CI tests do **not** count as executing that suite.
- No modification to owner Neon, `main`, staging, production, real customer data or paid cloud accounts.

**Suggested next:** Request owner decision on R10-C1–C5. Continue other synthetic-only work on role visibility, invitations, file metadata and audit read policies, without introducing production writer or staging changes.

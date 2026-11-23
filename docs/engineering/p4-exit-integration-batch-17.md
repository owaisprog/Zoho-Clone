# P4 Batch 17 — synthetic audit cursor signing key rotation

Date: 2026-11-23. Internal CI-only demonstration; stacked on verified Batch 16. **Not a KMS, production secret-management or live-user rollout.**

## Five delivered work items
1. Strict current/optional-previous HMAC signing key ring with short allowlisted key IDs. Reject duplicate IDs, repeated secret material, unknown versions, weak secrets, or extra fields.
2. Wrap the existing 5-minute, actor/tenant/page-limit bound R16 signed audit cursor: prefix with versioned key ID, verify with selected key, and reject retired key IDs immediately.
3. Build an R17 restricted Prisma paging service that validates key configuration and cursor before DB access while re-checking tenant membership, roles, entitlement and visibility on every page using R15's same transaction.
4. Add an isolated/unmounted GET-only Express CI route for signed audit page reads. No public application registration, exports or mutations.
5. Add eight Node tests and actual disposable Postgres/Prisma/HTTP integration smoke for old-key grace, new-key issuance, immediate retirement, cross-tenant/actor replay denial, revocation and connection context cleanup.

## Safety and release limits
Signing keys are fictional test strings only, never production secrets. R16 token expiry is capped at 300 seconds. Accepting a previous key is an explicit local test configuration; removing it denies past tokens immediately. Production key storage, KMS, rotation orchestration, monitoring, secrets review and policy decisions are **OPEN**. No Neon or staging database migration, live Auth0 or real user/customer data. P4 exit #61, R10-C1–C5, 14 original risks, 12 decisions and 727 original unexecuted P1.09 acceptance cases remain open. No `main` merge or deployment.

CI pending when authored. Update draft PR only after verifying all four jobs.

# P4 Batch 23 — role, access revocation and organization authorization evidence

Date: 2026-11-23. Stacked on verified Batch 22. Internal engineering only, synthetic CI data. This report does not certify actual Auth0, commercial authorization or a production rollout.

## Five implementation tasks

1. **Real CI PostgreSQL / Prisma / HTTP role-grant revocation**: `backend/src/scripts/p4-ci-r23-role-revocation-evidence-smoke.ts` extends the R22 evidence script with fresh ORG_ADMIN role disable, immediate next-request 403 despite forged OWNER HTTP headers, restore without leakage, and independent active ORG_OWNER access. Real SQL changes are only on fictional bootstrap fixtures in disposable CI.
2. **Platform entitlement and tenant isolation**: same smoke disables Orchid's platform entitlement, asserts owner/admin/reviewer reads fail with one sanitized 403 shape while the Cedar owner remains authorized, restores the grant, and verifies administrator cannot request Cedar data by forging role or tenant headers; SALES_REP cannot elevate to organization IAM access.
3. **Owner-approved P1.06 regression**: `backend/test/p4-r23-policy-revocation-matrix.test.ts` adds nine tests for the existing 13-role × 22-resource = 286-row immutable design map, default deny on unknown resources, strict read/field-only access, revoked membership or disabled entitlement, required verified server evidence, separation of ORG_OWNER from CRM, read-only reviewer and duplicate/invalid role evidence.
4. **Original acceptance traceability**: add six strictly `CI_ONLY_PARTIAL` references in `docs/qa/p4-engineering-evidence-links.json` for API-T001-NEG, PERM-T009/010/026/027 and AC-099, bringing the registry to 26. All original 727 P1.09 cases remain `NOT_RUN_DOCUMENT_ONLY`, zero counted as executed and ownerAccepted=false. Add two more negative traceability assertions.
5. **Mandatory CI integration**: run R23 real Postgres/Prisma/HTTP verification after the R22 smoke; retain typechecks, builds, secret checks, source/compiled boundary checks, old SQL isolation, NO_GO and original inventory validator.

## Owner and security gates remain OPEN

No Auth0 live JWT/JWKS/MFA, no customer data or real invitations, no production role/team write endpoints, no approved owner-transfer flow, no owner Neon mutation, no stage or production deployment, no merge into main. R10-C1–C5 and P4 exit #61 remain open. All ten formal P4 release gates, the original 14 risks, 12 unresolved decisions, and **0/727 originally executed acceptance cases** remain unclosed.

This work is a narrow, truthful engineering proof with synthetic data only. CI verification pending when authored; final results belong in draft PR after verified GitHub Actions.

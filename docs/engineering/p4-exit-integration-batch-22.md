# P4 Batch 22 — identity, membership and tenant acceptance evidence

Date: 2026-11-23. Synthetic-only development on Batch 21. This is not production Auth0 verification, staging acceptance or P4 exit approval.

## Five implementation tasks

1. **Real disposable PostgreSQL/Prisma/HTTP identity and tenant smoke:** `backend/src/scripts/p4-ci-r22-identity-membership-evidence-smoke.ts` extends the existing R14 smoke with forged HTTP bearer/role/org headers, mismatched issuer/audience, expired/excessively long-lived and unverified synthetic SDK claims, unknown subject, and 12 concurrent cross-tenant owner/admin/reviewer reads. Preserves R14 revoked-membership, disabled-platform, private-field redaction and DB session-context cleanup assertions.
2. **Identity precondition unit coverage:** `backend/test/p4-r22-ci-identity-preconditions.test.ts` adds eight cases for mapped/email-verified issuer+subject, valid multi-audience, invalid issuer/audience/subject, expiration and time bounds, malformed mappings, provider failures, and rejection of browser-provided role authority.
3. **Ground original acceptance links:** `docs/qa/p4-engineering-evidence-links.json` now has 20 carefully limited links, adding cases AC-107/108, PERM-T002/003/004/005/007 and API-T002-NEG. Every link remains `CI_ONLY_PARTIAL`, original `NOT_RUN_DOCUMENT_ONLY`, and `ownerAccepted=false`. No original case is counted as executed.
4. **Validate all mappings and negative claim mutations:** The P1.09 traceability script now requires 20 distinct valid original IDs and real paths; extra tests reject forged owner acceptance and prove all original identity cases remain unexecuted.
5. **Mandatory real CI evidence:** GitHub Actions runs the R22 smoke after existing disposable PostgreSQL schemas and earlier IAM acceptance checks. Existing release `NO_GO` and original 727-case state checks remain mandatory.

## Limits / formal gates

These tests use injected fictional identity evidence, **not** actual Auth0 SDK verification or JWKS, real session revocation, production RLS roles, live invitation or team operations. They are not equivalently completed original acceptance cases, and do not authorize real customer data or external use. P4 exit #61, R10-C1–C5, ten P4 release gates, 14 original risks, 12 decisions, and all 727 original P1.09 cases remain OPEN / NOT RUN. No Neon migration, main merge, staging/production deployment or paid cloud activity.

CI pending at report creation; verify latest GitHub Actions success before calling this batch green.

# P4 Batch 42 — signed owner role history with disposable PostgreSQL

Date: 2026-11-24. Stacked on verified Batch 41; draft development only.

## Five engineering subphases
1. CI-only candidate 026 adds a narrowly granted owner-checked `SECURITY DEFINER` read function over existing immutable PostgreSQL role events, capped at 21 DB rows for a fail-closed 20-event API.
2. The R40 restricted-transaction service exposes `history()` returning only allowlisted event metadata and ISO timestamps; no tokens, request IDs or unrestricted audit records.
3. Test-only signed Express `GET /owner/:orgId/role-history`, on the existing verified RS256 fake issuer and DB subject mapper.
4. Strict read-only typed frontend parser/client and isolated history controller, plus tests for unknown fields, malformed dates, wrong order and clearing state after failure.
5. Required CI SQL installation and signed localhost frontend -> actual PostgreSQL test including non-owner, cross-tenant, revoked owner, direct table denial, secrets and context cleanup; CI contract and report.

## Limitations
No mutation to the normal Next.js site, backend app, real Auth0, JWKS, staging, owner Neon or production. CI bootstrap `SECURITY DEFINER` is not a production privilege architecture; no live audit retention/immutability review. Original 727 P1.09 formal acceptance cases `0 executed`; P4 `NO_GO`, all 10 gates, 14 risks, 12 decisions, R10-C1–C5 and issue #61 OPEN. No merge or deploy. CI evidence must be verified on exact final commit.

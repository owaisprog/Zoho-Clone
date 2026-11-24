# P4 Batch 43 — signed member revocation and invitation-only safe reactivation

Date: 2026-11-24. Stacked on verified Batch 42. Draft development only.

## Five delivered subphases
1. CI-disposable PostgreSQL candidate 027 adds owner-only atomic member revocation using fresh verified-owner DB checks, target membership update, immutable append-only membership event, and default-deny/no direct audit table grants.
2. Existing recipient-verified R30 redemption is **replaced only in isolated CI** to permit reactivation of a revoked MEMBER, but never an existing active member or OWNER. A fresh one-use token, verified recipient email, expiry and database-locked invitation remain required. No public React activation or user-body identity.
3. A PostgreSQL trigger resets any previously elevated SALES_MANAGER to SALES_REP on valid reactivation, increments role revision to invalidate stale role updates and appends a system-marked reactivation event in the same DB transaction; old role history stays immutable.
4. Unmounted RS256-signed Express owner revocation API, strict frontend CI-only POST client and safe controller. Bad user IDs, foreign tenant, self/owner revocation and request-body escalation are denied.
5. GitHub Actions real localhost fullstack smoke tests concurrent revoke (one success, one conflict), recipient outbox delivery, recipient JWT redemption/replay, role reset, audit, current memberships, no direct table grant and context cleanup. Focused backend/frontend tests, source safety contract and report.

## Non-release requirements
These SQL DEFINER functions run as disposable GitHub CI setup role only. Production needs least-privilege dedicated credentials, audit/retention reviews and the original P1.06 acceptance suite. The existing P4 R39 fictional Next.js UI remains disconnected. No real Auth0/JWKS/MFA, SMTP, KMS, owner Neon changes, production customer data, staging or production deployment, or main merge.

Original 727 P1.09 formal acceptance cases remain **0 executed**; P4 **NO_GO**, all 10 gates, 14 risks, 12 decisions, R10-C1–C5 and P4 exit issue #61 remain OPEN. Do not claim formal release readiness from disposable CI evidence alone. Must verify CI on exact final head before calling this batch engineering-verified.

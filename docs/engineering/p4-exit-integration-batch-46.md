# P4 Batch 46 — owner cancellation of persisted fictional invitations

Date: 2026-11-24. Stacked on CI-verified Batch 45.

## Five subphases
1. CI-disposable PostgreSQL audit table with FORCE RLS, current-owner INSERT-only policy, unique cancellation-per-invitation, immutable event trigger and no table read/update privileges for the runtime role.
2. Transactional service performs fresh verified-owner/tenant check and expected-version CAS on a still-live pending invitation; atomic revoked state, old encrypted outbox queued-delivery invalidation via owner-rechecked R45 function, and append-only cancellation event. Cannot cancel accepted/expired/other-org records.
3. Unmounted optional R33 RS256-signed fictional Express cancel endpoint, cache-control/nosniff, strictly input-limited; no public or customer routes.
4. Strict CI-only typed frontend cancel method and independent interaction controller; cancellation clears stale state after denial or conflicting version, with frontend/backend regressions.
5. Required GitHub CI source isolation, actual localhost signed Express -> disposable PostgreSQL smoke: concurrent one-success/one-conflict, revoked token not redeemable, queued ciphertext dead, post-cancel owner renewal works, separate-tenant and expired denial, immutable cancellation evidence and no context leak.

No real Auth0/JWKS/MFA, merchant data, SMTP, KMS, production privilege design, owner Neon migration, staging, merge or deployment. This work does not mount an endpoint in normal Next.js or Express app. **Phase 4 NO_GO**, original formal 727 P1.09 acceptance cases 0 executed; all 10 release gates, 14 risks, 12 decisions, R10-C1–C5 and exit issue #61 OPEN.

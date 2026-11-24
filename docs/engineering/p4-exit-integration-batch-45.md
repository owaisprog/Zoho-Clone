# P4 Batch 45 — Persisted invitation renewal

Date: 2026-11-24. Stacked on verified Batch 44. Five implemented subphases:

1. Disposable PostgreSQL immutable renewal audit with FORCE RLS and restricted owner INSERT, plus owner-checked cancellation of queued old encrypted deliveries.
2. Transactional renewal service checks fresh verified owner, tenant, old invitation version/status, active recipient membership, and max-three renewal limit. It replaces only revoked/expired invitations, generates fresh 256-bit token hash, inserts AES-GCM encrypted delivery and append-only audit in one transaction.
3. Signed fictional RS256 Express owner API, opt-in mounted in CI only, with strict body and redacted result.
4. Typed localhost-only frontend HTTP renewal client and safe controller plus frontend/backend regressions.
5. Mandatory source boundary, real signed end-to-end CI PostgreSQL test for concurrent conflicts, foreign tenant, expiration, old link denial, token redemption/replay, ciphertext outbox and audit isolation.

Formal release state NO_GO. Original P1.09 acceptance 0/727 executed. Ten gates, fourteen risks, twelve decisions, R10-C1–C5 and owner exit issue #61 remain OPEN. No live Auth0, real SMTP/KMS, staging, production, owner Neon, merge or deployment. The CI function owner is disposable and not a production security design.

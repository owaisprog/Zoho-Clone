# P4 Batch 56 — Fictional recipient self-service invitation acceptance UI

Five subphases:
1. Implement a strict token-free frontend recipient controller with 64-character lowercase hex token validation, lock on concurrent submissions, reset sequence counter to discard stale replies, and generic denied/accepted state.
2. Build an actual responsive React/Tailwind form with password-masked invitation token, user accessible inline status, no autocomplete, no token retained after submit, success/denial and retry/finish controls; keep it isolated from regular Next.js routes.
3. Reuse previously verified signed fake recipient-to-DB one-use R30 acceptance and R32 encrypted local-only invitation outbox with no extra backend privilege grant.
4. Unit and React SSR tests verify token privacy, malformed token network denial, duplicate-submit lock, reset/late acceptance race, generic errors, and no secret in the HTML output.
5. CI-only real signed owner-issue -> encrypted worker -> fictional mailbox -> verified Bob recipient React controller -> disposable PostgreSQL member activation, Alice wrong-recipient rejection, one-use replay denial, safe SSR, and clean SQL role/tenant contexts.

This is not an email-link landing page, a production registration flow, or a commercial identity session. No live Auth0/JWKS, SMTP, KMS, customer PII, owner Neon writes, merge or deployment. P1.09 original 0/727 acceptance tests executed, P4 NO_GO, all 10 release gates, 14 risks, 12 decisions, R10-C1–C5 and owner issue #61 remain OPEN.

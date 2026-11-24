# P4 Batch 48 — CI-only owner invitation keyset pagination

Five subphases: (1) disposable PostgreSQL narrow owner-only keyset with microsecond timestamp+UUID tie breaker; (2) signed HMAC ten-minute cursor bound to organization, status and literal search; (3) unmounted signed Express GET with strict query shape; (4) frontend localhost-only typed page client and denial-clearing next-page controller; (5) real signed RS256 HTTP -> PostgreSQL 25-row same-timestamp pagination, cursor tamper/cross-filter/cross-tenant/expiry denial and separate frontend/backend tests and CI source checks.

No cursor revocation store, no snapshot isolation across live status mutations, no commercial key rotation, no real Auth0/SMTP/Neon, no pagination of real customer personal data. Cursor contains only fictional tenant/filter and server-side timestamp/id metadata and is HMAC authenticated, not encrypted. No public app import, merge or deploy.

Formal P1.09 original 727 cases still 0 executed; P4 NO_GO, all 10 release gates, 14 risks, 12 decisions, owner issue #61 and R10-C1–C5 remain open.

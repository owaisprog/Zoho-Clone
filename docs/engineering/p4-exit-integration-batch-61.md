# P4 Batch 61 — Persisted CRM follow-up notes, disposable CI only

Five implemented subphases:
1. Owner tenant-bound PostgreSQL lead notes table: immutable insert-only lead note, fictional Demo text, creator, UTC time, unique write request and lead+tenant foreign key, FORCE RLS and no runtime table grants.
2. Restricted backend service with signed DB actor, role and tenant context per transaction. Only verified OWNER can append/list. Returned fields contain no raw provider subject, JWT or token.
3. Optional R33 signed GET/POST /owner/:orgId/leads/:leadId/notes; no normal app mount.
4. Typed frontend note client and controller; actual persisted readback, safe text validation, duplicate-suppression by server and fail-closed stale/tenant data clearing.
5. Frontend/backend unit tests, source guard and signed localhost Express→PostgreSQL smoke with two immutable notes, denied UPDATE/DELETE, member and unrelated organization denial, forged token and revoked-owner clearing.

**Limit:** note list intentionally fails closed above 20 per lead. Pagination and editable notes require separate approved design/security work. No live customer data, broad permission grants, real SMTP/Auth0, production/Neon writes, merge or deployment. Formal P1.09 original 0/727 executed, P4 NO_GO, all gates open.

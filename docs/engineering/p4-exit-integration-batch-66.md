# Phase 4 Batch 66: persisted CRM task paging (CI only)

Five engineering subphases: (1) guarded disposable PostgreSQL owner-only 20+1 keyset query for lead tasks; (2) signed 10-minute HMAC cursor bound to organization and lead, with fresh owner check on every page; (3) signed Express `GET /_p4_r33_ci/owner/:orgId/leads/:leadId/tasks/page?cursor=` route unmounted from the live app; (4) strictly parsed frontend task page client that rejects forged responses and non-local environments; (5) actual signed localhost RS256→Express→restricted PostgreSQL 25-task 20+5 smoke, cursor tampering/expiry, member denial, revoked owner denial, foreign-tenant/lead binding and pool-context reset.

**No formal product acceptance is implied**: original P1.09 remains 0/727; owner authorization, real Auth0, staging, supported production DB and permissions gates remain open. No merge, deployment, Neon mutation, customer data or live-route activation.

This implementation replaces the existing **over-20 task read blocker** only for the new page endpoint; the old bounded list still intentionally fails closed. The R65 React component is not yet attached to paging (planned Batch 67).

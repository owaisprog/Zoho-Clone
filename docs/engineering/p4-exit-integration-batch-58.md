# P4 Batch 58 — Persisted CRM lead stage workflow, CI only

Five subphases:
1. Narrow SQL status-transition function against R57 persisted leads allows only NEW→CONTACTED and CONTACTED→QUALIFIED/LOST with immutable audit, row lock and expected-revision compare-and-swap. QUALIFIED and LOST are terminal.
2. Restricted signed owner backend service performs exact row and event parsing under SET LOCAL ROLE, tenant scope, and transaction rollback on conflicts or authorization denial.
3. Optional R33 Express PATCH status and GET audit endpoints, restricted to fictional signed CI actors.
4. Strict frontend client and selected lead detail/controller verify history sequence, refetch persisted state, and clear on cross-org or denied reads.
5. Unit regression, CI source guard and real signed localhost HTTP→PostgreSQL smoke for New→Contacted→Qualified, alternate Lost path, stale/repeat edit rejection, immutable history DELETE denial, cross-tenant and nonowner isolation, and revoked owner.

No real CRM customer contacts, staff access grant beyond synthetic OWNER, business SRS feature-complete claim, production route, merge or deployment. Existing formal P1.09 0/727, P4 NO_GO, all release gates and outstanding risks/decisions remain open.

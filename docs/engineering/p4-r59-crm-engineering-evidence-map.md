# P4 CRM engineering evidence — Batches 57–59 (not formal P1.09 acceptance)

| Requirement demonstrated | Implementation | Reproducible engineering evidence |
|---|---|---|
| Create tenant-scoped fictional lead and block duplicate | `backend/db/candidates/038_p4_r57_ci_crm_leads.sql`, `backend/src/platform/p4-r57-ci-crm-leads.ts` | `scripts/p4-r57-crm-lead-fullstack-smoke.ts` |
| List only owner-scoped persisted leads and fail closed over 20 rows | R57 SQL `list_leads` and typed client | R57 frontend/backend tests, R57 fullstack |
| Atomic New → Contacted → Qualified/Lost transitions | `backend/db/candidates/039_p4_r58_ci_crm_lead_stage.sql` | `scripts/p4-r58-crm-lead-stages-smoke.ts` |
| Revision conflict and immutable change history | R58 `change_lead_status`, `p4_r57_ci.lead_events` | R58 fullstack and immutable event deletion-denial check |
| Original React fictional CRM UI | `frontend/src/components/p4-r59-ci-crm-workspace.tsx` | `frontend/test/p4-r59-ci-crm-react-workspace.test.ts` |
| Cross-org signed UI + actual Postgres writes | R59 controller + signed R33 optional router | `scripts/p4-r59-crm-react-workspace-smoke.ts` |

## Boundary

These are **executed engineering CI tests**, not executions of any original P1.09 formal acceptance case. The original 727-case acceptance set is still **0/727 executed**. Real Auth0/membership authorization, integration with the main Next.js router, staging/rollback, actual customer data permissions and owner approvals remain blocked by existing release gates. Phase 4 decision remains **NO_GO**, with no merge or deployment.

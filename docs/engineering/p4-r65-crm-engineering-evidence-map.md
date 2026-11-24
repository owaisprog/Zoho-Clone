# P4 Batches 63–65 — Engineering evidence, not formal acceptance

| Delivered workflow | Source | Executed CI engineering proof |
|---|---|---|
| Immutable lead note pages 20+5 | `backend/db/candidates/042_p4_r63_ci_crm_note_keyset.sql`; R63 pager/client | `scripts/p4-r63-crm-note-page-smoke.ts` |
| Signed HMAC cursor bound to org, lead and expiry | R63 service + signed R33 router | R63 forged/expired/wrong-lead/owner-denial tests |
| Create/list due-date task for fictional CRM lead | `backend/db/candidates/043_p4_r64_ci_crm_followup_tasks.sql`; R64 service/client | `scripts/p4-r64-crm-task-smoke.ts` |
| Atomic one-way task completion with immutable actor event | R64 SQL `complete_task` and task events | R64 stale/duplicate completion and immutable DELETE denial |
| Actual React notes + task composer | `frontend/src/components/p4-r65-ci-followup-workspace.tsx` | `frontend/test/p4-r65-ci-followup-workspace.test.ts` |
| Signed real React CRM 25 notes + task and two tenants | R65 controller + R54/R57/R58/R60/R61/R63/R64 | `scripts/p4-r65-followup-react-smoke.ts` |

These are **automated engineering tests** against fictional CI-only records, not original P1.09 acceptance-case executions. Original formal 727 cases: **0 executed**. Phase 4 NO_GO, 10 release gates/14 risks/12 decisions/R10-C1–C5/owner issue #61 remain OPEN. No merge, deploy or customer data.

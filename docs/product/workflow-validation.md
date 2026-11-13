# P0.05 — Workflow Validation and Acceptance

**Status:** Three draft maps created; **0/3 real-world workflow validations**. P0.05 issue #7 stays open.

## Evidence requirements for each map

| Workflow | Needed participant | Actual evidence | Validated |
| --- | --- | --- | --- |
| WF-ISO-01 | ISO onboarding/sales operator with real recent case | Stages, handoffs, bottlenecks, underwriter/processor ownership, exceptions | **NO** |
| WF-POS-01 | POS reseller activation/deployment operator | Merchant approval, equipment, delivery/install, activation, return/escalation | **NO** |
| WF-PAYFAC-01 | PayFac/submerchant operations owner | Provider vs. internal verification, capability state, restriction/review | **NO** |

If PayFac participation cannot be obtained, substitute a distinct verified workflow (e.g., wholesale ISO reviewing risk) **only with explicit owner consent**, and record the reason.

## Validation steps
1. Owner privately identifies legitimate operators and handles appropriate outreach/consent.
2. Interview about one actual recent case, not merely the participant's general opinion.
3. Verify actor/lane, sequence, trigger, decision owner, externally governed statuses and exception paths.
4. Confirm steps as **observed**, **directly described**, **vendor-documented**, or **assumed**; they are not equivalent.
5. Record real sensitive notes only in owner-controlled private storage, not the public GitHub repository.
6. Share only adequately sanitized corrections with ChatGPT.
7. Update maps, state transitions, data flow, permission/exception requirements and contradictions.
8. Product owner approves each final map after evidence review.

## Owner checklist (none completed)
- [ ] Private ISO contact selected, consent obtained, real workflow reviewed.
- [ ] Private POS contact selected, consent obtained, real workflow reviewed.
- [ ] Private PayFac contact selected, consent obtained, real workflow reviewed.
- [ ] Each map corrected based on actual evidence and independently approved.
- [ ] P0.05 closed only after 3 completed real-world validations.

**P0.04 documented shortfall:** 0 of 15–25 targeted interviews. See `p0-04-interview-shortfall.md` and issue #8. P0.05 cannot be closed simply because its diagrams look credible.

## Intended future engineering tests (NOT executed)
- Only authorized tenant members can access records.
- Agent reassignment cannot leak another agent's merchants.
- Internal status and external verified status cannot be conflated.
- Repeated/out-of-order processor events are handled safely.
- Approved vs boarded vs activated transitions remain distinct.
- Sensitive banking/card/identity details are not stored in generic merchant records.
- Exceptions remain auditable; stage change and history are atomic.

No frontend, backend, DB, API, provider, or software test was created in this pre-build phase.

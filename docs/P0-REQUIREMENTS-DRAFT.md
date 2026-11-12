# Provisional MVP Requirements — working draft (P0)

**Status: Not approved.** This is a proposal to support buyer interviews and technical prototyping. It is not a completed PRD or an evidence-based product decision.

## Intended user roles (to validate)
- Organization owner / operator: configures workspace, access and teams.
- Sales lead / agent manager: assigns and manages merchant prospects.
- Sales agent / reseller: views only permitted leads and updates activities.
- Underwriting / onboarding coordinator: runs a stage-based application checklist.
- Internal analyst: reads limited aggregated status and exports based on permission.

## Proposed first customer journey
1. An authorized tenant admin creates a private organization.
2. An agent is invited and given least-privilege access.
3. The agent creates a prospective merchant record with a named owner.
4. Sales logs activities and moves the opportunity through approved stages.
5. Onboarding receives an assigned checklist without storing live cardholder data.
6. Operations reviews status, exceptions and an audit trail.
7. A privileged user can export permitted non-sensitive data.

## Candidate epics and acceptance ideas

| ID | Proposed epic | First acceptance criteria | Gate |
|---|---|---|---|
| MVP-01 | Organizations & identity | Organization separation; invite/revoke; MFA plan; denial tests | P1/P3 |
| MVP-02 | Agent/reseller access | Ownership checks; role matrix; cross-tenant denial | P1/P3 |
| MVP-03 | CRM records and pipeline | Create/update/search under tenant scope; activity history | P1/P5 |
| MVP-04 | Onboarding | Assigned checklist; state transitions; status and audit | P1/P6 |
| MVP-05 | Tasks and reporting | Due dates and permitted aggregate counts | P1/P7–P9 |

These are hypotheses, not built features. Do not use real merchant PII in the prototype.

## Critical unknowns to resolve with buyers
1. Is onboarding coordination, agent visibility or fragmented CRM data the highest-value first workflow?
2. Which processors/CRMs must integrate in the first pilot, and how do their APIs/auth methods work?
3. What information may be collected and how must it be retained/erased?
4. Does the buyer require custom fields, approvals, residual dashboards, reseller hierarchy or branded merchant portals?
5. Who makes purchasing decisions and what evidence would secure paid pilot commitment?
6. Are there contractual limits on presenting/processing merchant or commission data?

## Nonfunctional acceptance candidates
- Every data access must be tenant-authorized on the server.
- Sensitive actions must be audited and attributable.
- Access revocation must be immediate for new requests.
- Background operations must be retry-safe and idempotent.
- Backups, restore tests, secrets separation, alerts and rollback precede production.
- Web and API builds must typecheck and pass automated regressions.

## Evidence-based P0 exit
Interview targets, validation signals and design/pilot commitment thresholds are tracked in [PHASE-0.md](PHASE-0.md). Until those are met, no feature scope is treated as locked.

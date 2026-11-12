# P0 — Market Validation and MVP Definition

**Status:** In progress, research draft prepared, customer evidence not yet collected.  
**Date opened:** 2026-11-12  
**Proposed first buyer:** ISO / PayFac / POS reseller / merchant services company.

## Problem hypothesis (not yet proven)
Payment services companies may need a unified internal experience for agent/reseller relationships, onboarding tasks, sales pipeline, operations status, residual/commission visibility and merchant-facing tools. Competing systems already cover portions of this; positioning must be validated.

## Draft MVP boundaries

### Candidate in-scope
- Organization, team and permissions (tenant-aware).
- Agent/reseller directory with ownership and access controls.
- Merchant prospect/CRM records and pipeline stages.
- Merchant onboarding checklist, status, assignment and audit trail.
- Tasks, activity history and operator dashboard.
- Export and basic operational metrics.

### Explicitly deferred unless validated
- Live payment processing, custody or cardholder-data storage.
- Building a financial ledger or payout engine.
- Full finance/HR suites and app marketplace.
- Complex AI agents acting on sensitive customer data.
- Carrier-grade commissions/residual calculations before source contracts and reconciliation rules are known.

## Discovery checklist
- [ ] Conduct 15–25 stakeholder interviews with actual buyers/operators.
- [ ] Record role, company segment, existing software, current workflow and concrete pain/cost.
- [ ] Confirm recurring high-priority pain from 5+ independent qualified organizations.
- [ ] Validate one workflow end-to-end with anonymized artifacts.
- [ ] Identify must-have integrations, migration format, compliance boundaries and data retention.
- [ ] Test willingness to pay, evaluation process and procurement requirements.
- [ ] Recruit 3 design reviewers and seek 2 suitable pilot organizations.
- [ ] Capture differentiation compared with incumbent software.
- [ ] Approve **proceed / narrow / pivot** with written rationale.

Do not mark interviews, prospects, pilot commitments or validation findings as complete until evidence is supplied.

## Interview questions (starting script)
1. Walk me through the last merchant onboarding case from first contact to activation.
2. Which steps live in spreadsheets, email, CRM, processor portals or shared drives?
3. Where do delays, duplicate entry, lost ownership or disputes occur?
4. How often does the problem occur and what does it cost in hours, churn or revenue?
5. Who owns the purchase decision and which data/security prerequisites apply?
6. Which existing product is closest to solving this? What is missing?
7. What workflow would justify a pilot, and what would block adoption?

## Evidence register

| ID | Date | Segment/role | Evidence source | Finding | Status |
|---|---|---|---|---|---|
| P0-E01 | — | — | — | Awaiting first interview | Pending |

Sensitive raw interview materials must not be stored publicly or committed without permission. Prefer de-identified summaries.

## Exit decision
- **Decision:** Pending validation.
- **Approved buyer and MVP:** Pending validation.
- **Owner signoff:** Pending.
- **P1 start:** Blocked for feature freeze, but reversible technical research may proceed.

## Next session
- Collect interview evidence or run targeted discovery planning.
- Agree the initial buyer persona and one workflow to prototype.
- Update this file with sourced facts and revised scope, not invented customer results.

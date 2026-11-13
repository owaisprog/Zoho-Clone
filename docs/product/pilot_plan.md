# P0.09 — Pilot / Design Partner Plan

**Project:** Zoho Clone
**Prepared:** 2026-11-13
**Status:** Pilot documentation prepared; owner explicitly decided to CONTINUE INTERNAL DEVELOPMENT WITHOUT PARTNERS on 2026-11-13. **0 confirmed partners; no external pilots or live application**.
**Issue:** https://github.com/owaisprog/Zoho-Clone/issues/12
**Prior gates:** P0.07 prospect claim validation 0; P0.08 buyer pricing interviews 0/5. These remain open while documents are drafted in parallel.
**Owner decision required:** Two credible design-partner commitments **OR an explicit decision to continue without them**.

## Pilot objective
Evaluate whether a narrow, original ISO merchant-operations CRM helps a team's members find the owner, internal status, and next action on a stalled merchant application without incorrectly claiming processor underwriting/activation authority. We are **not** piloting live payment processing, bank transfer, residual payouts, KYC processing or automated merchant approval.

## 1. Candidate partners and inclusion criteria
Prefer **two independent organizations** that meet most criteria:
- Independent ISO/merchant services company (primary); POS reseller (secondary) if useful for diversity.
- Named economic buyer and a separate daily operational champion.
- Willing to explain an actual recent workflow and a high-impact pain that exists **despite** current tools.
- Can use only *synthetic or explicitly approved deidentified data* until security, tenancy and retention controls pass.
- Has at least 3–5 relevant internal users willing to execute scripted scenarios.
- Understands the feature scope and accepts that direct processor boarding/residual payouts do not exist.
- Can state a realistic authorization/procurement path, problem metric and concrete next action.
- Does not require real sensitive payment/ID/bank files in an unreviewed application.

Reject/hold if buyer has no operational sponsor, demands live acquiring/integration or payout on day one, cannot protect private data, or expects full Zoho suite before a pilot.

## 2. Short application template (not a live web form)
- Organization pseudonym / private contact reference (never in public GitHub)
- Business segment: ISO / POS / PayFac / other
- Buyer job title category; internal operational champion role
- Approximate internal seats and merchants managed **as volunteered ranges**
- Current tools and required integrations
- Last actual slow/stalled application problem (redacted)
- Whether a limited tracking-only prototype would solve a first use case
- Required permissions/agent access and restrictions
- Can testing use synthetic cases only? yes/no
- Pilot decision owner and procurement/security milestones
- Success metric agreed with buyer
- Actual next action (review, MOU, approved budget, paid pilot proposal), consent for follow-up
- Conflict-of-interest / referral/processor restrictions
- Terms acknowledgement: **not production software, no production service guarantee, no payment processing**

**No application has been collected from a real participant.**

## 3. Pilot lifecycle and readiness gates

| Stage | Owner/action | Gate |
| --- | --- | --- |
| Recruit/qualify | Owner checks role and fit | Buyer + champion identified; consent |
| Discovery | Owner/ChatGPT from sanitized notes | A real recent workflow + incumbent coverage documented |
| Scope | Owner with product checklist | One primary scenario and permitted synthetic data |
| Pre-pilot security review | Qualified independent reviewers as appropriate | Tenant/access/backup/log/privacy tests **passed on real code** |
| Optional private prototype evaluation | Authorized team users only | Synthetic data, verified demo, no false production claims |
| Formal pilot acceptance | Buyer + owner | Signed pilot terms, scope, support and responsibilities |
| Pilot tasks | 3–5 staff across >=5 cases (proposed) | Correct owner/status/action and measured task time |
| Review/decision | Buyer and product owner | Continue, adjust scope, no-go, or defer with documented evidence |
| Data offboarding | Owner + system admin | Data export/removal per applicable written terms and testing |

A simulated clickable UI review is not the same as a production pilot.

## 4. Candidate pilot size and resource parameters (not commitments)
- **Internal users:** 3–5 initial test users per organization.
- **Use cases:** 5 synthetic merchant applications with at least 2 blocked/exception paths; later add an authorized deidentified case if policy permits.
- **Data import:** Start with a manually verified synthetic CSV of 20–50 rows; actual migration sizes decided from approved capacity tests.
- **Trial duration:** Discuss a **30-day evaluation** once a real build and terms exist. This is not a delivery promise or automatically approved free trial.
- **Support:** Named project-owner contact and written response/escalation procedure, not an invented 24/7 SLA.
- **Access:** Tenant-specific invites and least-privilege team accounts; no agent/customer portal by default.
- **Data storage/retention:** Synthetic-first; data lifecycle and deletion agreement needed for any customer-derived content.
- **Integrations:** NONE presumed. Any external connector requires partner agreement and auth/security tests.

## 5. Proposed success scorecard

| Dimension | Measurement | Proposed threshold (not achieved) |
|---|---|---|
| Owner/status/next action accuracy | Correct triad on each synthetic stalled case | 100% for critical cases |
| Time-to-answer | Median seconds versus **measured** incumbent baseline | Candidate >=30% lower if comparable |
| Workflow completeness | % of priority tasks evaluable within prototype | >=80% of mutually scoped tracking tasks |
| Onboarding clarity | Can a new authorized user finish guided task with little help | Record actual failures; no predetermined guaranteed number |
| Tenant/role isolation | Server-side cross-tenant and restricted record denial | **Zero critical/high unresolved findings** |
| Forbidden-data handling | Unknown/prohibited field rejection and no raw secret logs | **100% required negative tests pass** |
| Adoption | At least 3 internal participants complete tasks | Proposed, not proven |
| Buyer commitment | Documented buyer next action and approved conditions | Required for commercial go decision |

These thresholds need owner acceptance and real measurement, with incident/negative evidence included.

## 6. Minimum release and contract requirements
Before sharing access beyond a static concept/mockup:
1. Auth, roles, tenancy, data minimization and record policies are implemented **and actually tested**.
2. Privacy notice, data processing roles, user consent, location/hosting and retention are determined for target markets.
3. No production financial/card/ID docs are collected in merchant CRM.
4. Access logging, backup and recoverability and incident contact procedure exist.
5. Terms clearly state beta nature, permitted data, responsibility, no payouts/processor approvals, incident handling, exit and deletion.
6. Buyer authorizes participation and internal use. No implied affiliation with Zoho, processors or incumbents.
7. Pre-pilot data removal/export procedure tested.
8. Real costs, supplier terms and support capacity checked.

## 7. Commitments or explicit alternative decision
**Roadmap P0.09 exit:** "Two realistic pilot commitments or explicit decision to continue without them."

Evidence today:
- Confirmed partners: **0/2**
- Signed terms: **0**
- Letter of intent with named buyer: **0**
- Authorized live pilot deployment: **0**

**Recommended alternative if owner prioritizes progress:** record a specific decision to **continue internal engineering using synthetic demo data without design partners**, with *no claim of market validation* and no live merchant rollout. This is a decision option, **not yet owner-signed**.

## 8. Negative and positive evidence handling
If every qualified buyer needs processor boarding or residual workflows on day one, stop assuming tracking-only MVP has commercial value. Do not manufacture two "pilot commitments" from generic interest, social media likes or connection accepts. Store identifiable lead/partner details **privately**, not in this public repository.

## 9. Ownership and handoff
**Product owner:** approves customer outreach, selects any partner, handles legal terms, controls infrastructure, decides proceed/no-go.  
**ChatGPT:** generates app/scorecard scripts and repository artifacts, analyzes redacted feedback, prepares implementation/testing plans when later phases authorize.

**P0.09 is CLOSED under the roadmap's alternative exit: product owner explicitly approved continuation WITHOUT design partners for internal synthetic-only engineering on 2026-11-13. Two commitments have NOT been obtained; 0/2.**

## References
[Positioning](positioning.md) • [Interview kit](customer-interview-playbook.md) • [Pricing hypotheses](pricing_hypotheses.md) • [Data protection](data_classification.md) • [Workflow assumptions](workflow-maps.md)

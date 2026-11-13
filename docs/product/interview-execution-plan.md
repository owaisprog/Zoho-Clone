# P0.04 — Recruitment, Execution and Evidence Plan

**Project:** Zoho Clone
**Status:** Recruitment protocol owner-approved 2026-11-13; no outreach has been sent, no interview booked or completed. External research is tracked separately in issue #8.
**Primary document:** [Customer Interview Playbook](customer-interview-playbook.md).

## 1. Recruitment targets and operating sequence

Targets are research planning assumptions; adapt to response rate and buyer access.

| Segment | Qualified interviews | Mix | Why |
| --- | ---: | --- | --- |
| ISO/merchant services | 8–12 | Buyers, sales/agent ops and onboarding ops | Approved first ICP |
| POS providers/resellers | 4–7 | Owners, field/activation and support leads | Approved second ICP |
| PayFac/software-led payments | 3–6 | Product/operations and compliance/security | Approved third ICP |
| **Total** | **15–25** | Distinct people; track unique companies separately | Aim for diverse evidence |

Suggested recruiting pool: potentially 40–80 suitable contacts **as a planning hypothesis only**, but do not send automated bulk outreach or use private contact data in the public repository. Keep lead names/contact details in a private system under the owner's control.

### Sequence

1. Identify companies matching ICP criteria from appropriately available public information and owner relationships.
2. Verify there is an appropriate buyer/operator to invite; exclude people outside the role.
3. Send a short, personalized request for a *research conversation*, not a deceptive sales pitch.
4. Ask consent for notes, recording if used, and follow-up separately.
5. Conduct neutral discovery first; only then present the limited MVP hypothesis.
6. Record a structured private interview note and tag evidence confidence.
7. Aggregate anonymized patterns after every 4–5 interviews; do not overwrite contradictory evidence.
8. Re-rank ICPs only after meaningful buyer evidence. Bring major product pivots to the owner.
9. Produce findings/decision memo and later phase backlog changes, with links to sanitized evidence counts.

## 2. Privacy and storage policy

**The Zoho Clone GitHub repository is public.** Never add real prospect contact lists, direct identifiers, recording URLs, transcripts, individual employment details, merchant IDs, banking/payment data, authorization documents or company-specific non-public workflow screenshots.

Store sensitive notes only in an access-controlled private location chosen by the owner. Keep an anonymous public aggregation such as `ISO-07, ISO-ops lead, 2+ reported handoff issues` only when it cannot identify the respondent. Even anonymized unique facts may re-identify small companies; aggregate where necessary.

Retention and lawful basis/consent must be checked for intended jurisdictions. No assumption that permission to interview implies permission to record, publish quotations, or share contact information.

## 3. Proposed schedule (not a promise)

| Work unit | Definition of done | Owner |
| --- | --- | --- |
| Approve protocol | Owner confirms scripts and privacy rules | Owner |
| Identify initial 10–15 qualified contacts | Private, verified target list; no repo upload | Owner with AI research assistance |
| Initial outreach | Personalized invitations sent through authorized communication method | Owner |
| First 3–5 interviews | Record dated, consent-compliant notes and objections | Owner |
| Early synthesis | Distinct recurring problem statements and contradictions | ChatGPT from redacted data |
| Remaining target interviews | Diversified evidence across approved segments | Owner |
| Evidence review | ICP scores adjusted, viability assessed | ChatGPT recommends; owner decides |

Interviews depend on respondent availability; the scheduling targets are not commitments.

## 4. Individual interview scoring

This structure **prioritizes evidence**; it is not a probability model.

| Dimension | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Workflow problem | None | Hypothetical | Recent example | Repeated examples |
| Business impact | None | Vague | Credible time/cost effect | Measured recurring effect |
| Buying authority | Not identified | Influencer only | Identified buyer | Buyer engaged |
| Pilot feasibility | Impossible | Conditional | Possible with manageable steps | Concrete proposed next action |
| MVP fit | Needs non-MVP core | Major missing components | Fits with minor changes | Fits tested scope |
| Evidence reliability | Opinion | One anecdote | Consistent specifics | Triangulated/observable |

Capture actual interview answers first; assign scores later. A 3/3 in verbal interest does not equal a signed order.

### Aggregate decision criteria (owner-approved thresholds to propose)

- **Strong signal:** At least 5 independent qualified organizations report a materially similar recent problem, with identified buyers and workable pilot constraints.
- **Pilot trigger:** 2 prospects request specific pilot conditions or give comparable concrete commercial intent.
- **Caution trigger:** Most buyers require live processor boarding, residual payouts or security features outside MVP before considering any paid use.
- **Pivot trigger:** More favorable evidence exists in POS/PayFac than the ISO segment after correcting for interview counts.

These are **illustrative gates**, not statistical significance.

## 5. Hypothesis-to-evidence matrix

| Hypothesis | Valid supporting evidence | Contradictory evidence | MVP implication |
| --- | --- | --- | --- |
| Customers lack onboarding status visibility | Several recent examples of manual status chasing | Staff already get timely complete status from one system | Need narrower value proposition |
| Agent/merchant relationships are poorly supported | Multiple workarounds or access incidents | Existing app has secure usable hierarchy | Focus elsewhere |
| Faster setup is valuable | Measurable time/error reduction during trial | Incumbent setup works with little friction | No differentiation |
| Tracking-only MVP is sellable | Buyer agrees to paid pilot absent processor integration | Processor boarding is mandatory | Adjust MVP or change segment |
| Data import is a switching bottleneck | Repeated historical import pain and compatible sample files | Rare migration/fully solved | Lower feature priority |
| Operational dashboard has paid value | Buyer names recurring reports with associated cost | Reporting meets current needs | Avoid report-first strategy |

## 6. Research-to-product backlog rules

Before a user request becomes a feature ticket:
1. Connect to a specific repeated buyer workflow and consequence.
2. Record why existing alternatives fail for that context, or why customer still wants integration.
3. Estimate implementation/security complexity and affected tenants/roles.
4. Link to planned phase ID and prerequisites.
5. Prioritize only after the product owner reviews the evidence and scope.
6. Record rejected/contradicted requests without deleting them.

Example: If ISO customers cannot track which agent owns stalled applications, map to P8 agent assignments, application history, and role visibility. If they demand automatic ACH residual payouts, **do not** sneak payout execution into P8 MVP; create a specialist later-phase dependency requiring financial/legal design.

## 7. Interview data model (private)

Recommended private fields:
- `interview_id` pseudonymous unique identifier
- `consent_notes` yes/no; `consent_recording` yes/no/not asked
- `segment`, `role_category`, `buyer_champion_user`
- `date` and a restricted contact lookup outside GitHub
- `current_tools` and `recent_workflow_summary`
- `pain_incident`, `frequency_estimate`, `impact_metric`
- `alternative_strengths`, `switching_barrier`, `must_have_integration`
- `budget_process`, `security_constraints`, `pilot_conditions`
- `evidence_for`, `evidence_against`, `unknowns`
- `scores`, `followup_allowed`, `next_step`

See the CSV header template for **non-identifying, aggregate use only**. Do not populate it with live private respondents in this public repo.

## 8. P0.04 exit gate

P0.04 is the **protocol setup sub-phase** and is complete only after:
- All three segment tracks and optional buyer/operator probes are documented.
- Privacy/consent and secure research handling rules are accepted.
- Interview templates and hypothesis-scoring protocol are usable.
- Product owner approves recruitment/outreach approach and takes responsibility for manual contact and real interviews.
- The progress issue is updated with the owner's approval.

**This is not a license to claim actual validation.** P0.05 and later discovery stages remain subject to evidence and are not automatically marked complete.

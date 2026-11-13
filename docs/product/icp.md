# P0.02 - Customer Segment Map (ICP)

**Project:** Zoho Clone
**Created / researched:** 2026-11-13
**Status:** WORKING DRAFT; segment ranking requires owner review; customer interviews have not been conducted.
**Source roadmap:** P0.02 - Customer segment map; planning size 2-5 days
**Prior gate:** P0.01 approved by product owner on 2026-11-13.
**Owner-selected first product direction:** Specialized Merchant Operations CRM, within the eventual full Zoho-like application ecosystem.

> Evidence policy: External product documentation establishes that a workflow exists and competitors serve it; it does **not** establish that our customer prospects have unsolved problems, budget, purchase intent, or willingness to switch. All numeric rankings and proposed company-size ranges below are initial assumptions to test.

## 1. Why this segment map exists

The long-term product covers every identified major Zoho application, but a single first customer group is needed for useful product design and a viable initial sale. This document identifies the first three buyer segments, their jobs to be done, how the selected MVP matches them, buying process, and observable events that could indicate urgency. It explicitly separates payment-industry buyers from the later generic-SMB, agency and enterprise markets.

**Direct customer:** The ISO/POS/payment company buying the software, **not** an end merchant purchasing direct from our company.

## 2. Provisional top-three ranking

| Rank | Segment | Primary economic buyer | Daily champion / operator | Core job to be done | Working priority |
| --- | --- | --- | --- | --- | --- |
| **1** | Independent ISOs and merchant services providers | Founder/CEO, COO, VP Operations | Merchant onboarding manager, sales manager, agent manager | Track leads, agents, merchants and onboarding from inquiry to activation, with clear ownership and status | PRIMARY |
| **2** | POS providers/resellers with merchant onboarding and field deployments | Founder/GM, COO, Director of Operations | POS deployment/activation manager, merchant success manager | See merchant progress, hardware/install status, resellers and support handoffs together | SECONDARY |
| **3** | PayFacs and software-led payment providers / ISVs | COO, VP Product, Head of Payments | Product/engineering lead, compliance/onboarding lead | Coordinate submerchant lifecycle and integrate specialist workflows without replacing the payment core | TERTIARY |

### Segments intentionally deferred

- **Generic SMB CRM buyers:** Large and crowded market; no initial niche differentiation. Relevant after core CRM becomes reusable.
- **Software-development agencies / B2B services:** Later Projects, CRM, invoicing and support bundle. They are not the initial ICP for merchant-specific onboarding.
- **Enterprises and banks:** Extended procurement, compliance and integration cycles; explore after security/enterprise maturity.
- **Individual merchants (restaurants, salons, retail shops):** They are potential end-users of later white-label products sold *through* payment companies, not initial direct SaaS customers.

## 3. Hypothesis scorecard (not observed market measurements)

Criteria and weights: urgency of pain (25%), reachable decision-maker (15%), plausible willingness to pay (20%), fit for bounded initial CRM/onboarding MVP (20%), manageable integration/compliance burden (10%), reusable future suite capabilities (10%). Score each on 1-5, where **higher is better**. All individual ratings are internal judgments needing interview review.

| Segment | Pain (25) | Buyer access (15) | Willingness (20) | MVP fit (20) | Feasibility (10) | Reuse (10) | Total / 100 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Independent ISO / merchant services | 4 | 4 | 4 | 4 | 3 | 5 | **80** |
| POS resellers / payment partners | 4 | 3 | 3 | 4 | 3 | 4 | **71** |
| PayFac / software-led payment provider | 5 | 2 | 4 | 2 | 2 | 4 | **67** |

Formula: `score = SUM(weight * rating / 5)`. **These scores are prioritization hypotheses, not statistically justified precision.** Do not publish as verified market research.

## 4. ICP 1: Independent ISO / merchant services provider

### Definition and qualification assumptions
- Primary market to validate: US and other markets where buyer, processor integration and contracting are commercially feasible; no selling jurisdiction has been approved yet.
- Potential organizational size for discovery: roughly 10-200 employees, or an equivalent network of agents; **not a fact about the overall market**.
- Needs an active merchant application workflow and manages multiple agents, processors or merchant accounts.
- Likely signals: rapidly growing merchant portfolio, hiring operations staff, multiple onboarding systems, agent onboarding, or recurring complaints about application status visibility.
- Exclude initially: firms needing the product to perform actual acquiring, settle funds, underwrite autonomously, or run residual payouts as a launch requirement.

### People and responsibilities
- **Economic buyer:** CEO/Owner or COO. Controls software budget and operational change.
- **Champion:** Head of Merchant Operations / Onboarding Manager. Experiences daily handoffs and bottlenecks.
- **Technical reviewer:** IT/Operations systems administrator, sometimes external consultant.
- **End users:** Sales reps, agent managers, onboarding reviewers and managers.

### Job to be done
"When a lead becomes a merchant application, my team should know who owns it, which processor/agent it relates to, what stage it is in, what action is pending, and when it becomes active—without chasing multiple spreadsheets and inboxes."

### Hypothesized pains (must be tested)
1. Prospect-to-merchant handoff loses context or ownership.
2. Agents and merchants have relationships that generic CRMs model poorly.
3. Application updates are manually gathered from email/portals.
4. Management cannot reliably see stalled applications and operating workload.
5. Disconnected CRM/boarding/support tools cause duplicate entry.

### First release fit
- CRM records and ownership, customizable deal pipeline, agent records, merchant records.
- Merchant application stages, checklists, assignment, history, reminders and dashboards.
- Import/export, tenant roles, restricted record access, audit and subscriptions.
- **Not** automated underwriting, processor submissions, residual calculation or payout execution during MVP.

### Typical purchasing sequence (hypothesis)
Champion identifies status/ownership problem -> short discovery with operations -> product walkthrough with 1-2 anonymized onboarding cases -> technical/security review -> trial/pilot with internal users -> CEO/COO procurement and contract -> onboarding/import and training.

### Questions for buyer discovery
- How many merchant applications per month and which processors?
- How often do applications wait because status/owner is unclear?
- Which software and manual records are used today?
- Who signs off on changing CRM/onboarding systems?
- Could a standalone tracking layer be useful without processor API integrations?
- What would block a paid 30-day pilot?
- What reporting is currently produced by hand?

### Win conditions (to validate)
At least several prospects independently identify the same operational bottleneck, can explain its cost, agree the limited MVP addresses it, and are willing to pilot with a real internal workflow.

### Major objections
"We already have Merchant Central/IRIS"; "we require direct processor boarding"; migration effort; sensitive data security; cost of retraining teams.

## 5. ICP 2: POS provider / reseller

### Qualification assumptions
- Business resells or deploys POS systems, onboards merchants and coordinates sales, hardware and activation.
- Organizational size for discovery: roughly 5-100 internal users; verify.
- Buying trigger: expansion into more devices/locations or repeated missed deployment handoffs.

### People
- **Buyer:** Founder, COO, operations GM.
- **Champion:** Deployment/activation manager or reseller operations manager.
- **Technical reviewer:** POS integration or support lead.

### Job to be done
"After we sell a POS solution, track the merchant's account, device order, installation, activation and support handoff without losing the work between sales, installers and customer service."

### Hypothesized pains
- Merchant approval and POS hardware deployment status appear in separate systems.
- Field technician assignments and terminal installation steps are not linked to merchants.
- Resellers need account-level visibility without exposing other reseller portfolios.
- Merchant support requires looking up device/merchant records across tools.

### Initial MVP fit and gaps
Fits: leads, accounts, merchants, agents/reseller links, application statuses, tasks, simple reporting.
Deferred: serial-number inventory, warranty tracking, field technician routing, hardware shipment sync, native device control, full POS software.
Risk: Buyer may insist on these deferred modules before purchasing.

### Buying process
Founder/operations discovery -> workflow demo with merchant + device activation handoff -> integration feasibility check -> pilot with one reseller/team -> owner approval -> rollout.

### Validation questions
- How do you track hardware serial numbers, installation appointments and deployment exceptions?
- What software controls the actual POS?
- Does a merchant-focused CRM solve a real paid need before hardware integration?
- Which platforms (Clover, other POS/processor systems) must be supported?
- Who owns POS software and hardware credentials?

## 6. ICP 3: PayFac / software-led payments provider

### Qualification assumptions
- Software platform embeds payments or manages submerchant onboarding and operations.
- Potential size: 20-250 employees for early discovery, but many providers vary widely.
- The buyer has an established payments/processor infrastructure and may require strong API/security review.

### People
- **Buyer:** COO, VP Product, Head of Payments.
- **Champion:** Product operations/onboarding head.
- **Technical gatekeepers:** Engineering/security/legal/compliance leaders.

### Job to be done
"Coordinate submerchant onboarding and merchant lifecycle visibility across product operations while preserving compliance responsibilities and integrating with our existing payments stack."

### Why not first
PayFac operating models can include KYC/AML, underwriting, risk review, payout relationships and data protections. These are not simple CRM fields; provider integration and security requirements make the first sale and development more involved.

### MVP fit and gaps
Fits: generic CRM, application status tracking, approved notes, tasks and operational reporting.
Gaps: compliance-grade onboarding, KYC/KYB orchestration, ongoing risk surveillance, fund flows, processor contracts and deep system integrations.

### Buying process
Product/ops discovery -> technical integration review -> security/compliance procurement -> pilot in a controlled environment -> multiple stakeholder approvals -> integration deployment.

### Validation questions
- Which submerchant onboarding data must the system own vs. reference?
- Which providers own risk, verification and fund movement?
- Can a tracking-only layer create value without touching regulated data?
- What API, SSO, security and audit requirements are mandatory for a pilot?

## 7. Product fit matrix

| Capability | ISO | POS reseller | PayFac | Phase |
| --- | --- | --- | --- | --- |
| Multi-tenant organizations, identity, roles | Essential | Essential | Essential | P4 |
| Leads, accounts, deals, pipelines | Essential | Essential | Useful | P5 |
| Agent/reseller relationships | Essential | Essential | Sometimes | P8 |
| Merchant records and app stages | Essential | Essential | Essential | P8 |
| Tasks, reminders, history | Essential | Essential | Essential | P5/P8 |
| Basic dashboards and exports | Essential | Essential | Essential | P5/P8 |
| POS device/terminal deployment | Optional | High | Varies | Post-MVP |
| Processor boarding API | High later | Varies | High | V1+/integration track |
| Residuals import/calculation | High later | Medium | Varies | V1/V2 |
| KYC/KYB/AML orchestration | May be required | May be required | High | Specialist future |
| Dedicated external portal | Later | Later | Often | V1/V2 |
| Native acquiring/settlements | Out of scope | Out of scope | Out of scope initially | Specialist, not MVP |

## 8. Qualification and disqualification checklist

A high-fit pilot prospect should:
- Be the **payment/POS company**, not an individual merchant.
- Have a repeated merchant application workflow with named owners.
- Be willing to describe current tools and share synthetic/redacted examples.
- Have someone authorized to decide on a pilot.
- Accept an MVP that initially **tracks** onboarding rather than directly boards/transfers money.
- Need a simpler workflow or better visibility than existing tools, evidenced by examples rather than promises.
- Agree to measurable pilot goals (for example, time to identify stalled applications or reduced manual handoffs).

Disqualify or defer if:
- A custom processor integration, full residual payouts or native payment processing is mandatory on day one.
- Production credit-card data, identity documents or banking credentials must be stored before security/legal readiness.
- The buyer expects a comprehensive finished Zoho replacement at MVP launch.
- There is no economic buyer or operational champion.

## 9. Interview and evidence plan

**Not yet conducted**. In P0.04, prepare structured interview notes and collect **15-25** interviews across the ranked segments, targeting roughly 8-12 ISO, 4-7 POS and 3-6 PayFac/product interviews; reallocate according to actual response rates.

Record for each:
- Company type/size/region (only with appropriate consent).
- Role and decision authority.
- Current lead-to-merchant workflow.
- Actual software, process steps, workarounds and bottlenecks.
- Frequency, cost, urgency, and examples of the problem.
- Must-have integrations, compliance and security constraints.
- Actual budget or willingness-to-pay **evidence**, not hypothetical price agreement.
- Pilot readiness, success metric and next step.

Minimum evidence for final prioritization:
- Multiple distinct interviewees independently report the same urgent workflow problem.
- At least one real workflow diagram and anonymized record set can be tested.
- Buyer/sponsor and procurement requirements are known.
- Strongest competitors and switching barriers are documented.
- At least two prospective paid pilots or comparably strong written intent, if achievable.

A failed or partial interview target should be recorded explicitly; never fabricate interviews or testimonials.

## 10. P0.02 acceptance checklist

- [x] Three initial ICPs ranked (provisional).
- [x] Buyers, champions, users and jobs-to-be-done described.
- [x] Product fit, pain hypotheses, qualification, exclusion and buying process mapped.
- [x] Generic SMB and agencies distinguished from payment company buyers.
- [x] Public sources linked, with fact/inference boundaries.
- [x] Scorecard supplied as CSV.
- [ ] Owner reviews and approves the P0.02 ordering and qualification assumptions.
- [ ] Direct customer validation incorporated later during P0.04/P0.05; ranking updated if evidence contradicts assumptions.

**Phase status: IN PROGRESS.** Public documentation supports market/workflow relevance; no customer interviews or paid pilot commitments are claimed.

## 11. Research sources and limits

See [P0.02 evidence log](p0-02-evidence.md) for links and supported factual statements. This is desk research, not a substitute for interviews.

- NMI Merchant Central: https://www.nmi.com/products/merchant-central/ (existing payments CRM, onboarding, agent reporting, residuals and support).
- NMI boarding: https://www.nmi.com/products/merchant-central/merchant-boarding/ (processor-specific onboarding and integrations).
- NMI residuals: https://www.nmi.com/products/merchant-central/residuals-management/ (financial/agent reporting complexity).
- Clover partner resources: https://partners.clover.com/bankeredu/home/ (POS and online merchant enrollment).
- Stripe PayFac guide: https://stripe.com/guides/payfacs (PayFac onboarding/compliance responsibilities).

**Next phase after approval:** P0.03 - Competitive Capability Matrix.

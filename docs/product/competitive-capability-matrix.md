# P0.03 - Competitive Capability Matrix

**Project:** Zoho Clone
**Research date:** 2026-11-13
**Status:** DRAFT - desk-research comparison prepared; product-owner approval and prospect validation pending.
**Dependency:** P0.02 segment priorities approved on 2026-11-13.
**Tracking issue:** https://github.com/owaisprog/Zoho-Clone/issues/5
**Scope:** First niche release (ISO/POS/PayFac merchant operations CRM), with a check against major generic CRM/Zoho-suite capabilities. The separate long-term product tracks remain in the master roadmap.

## 1. Research approach

The evaluated providers are 3 payment-industry products and 3 horizontal CRM/ecosystem providers:

- **NMI Merchant Central** — Industry specialist; sources: N1, N2, N3, N4.
- **ISOhub** — Industry specialist; sources: I1, I2.
- **PayHub by SignaPay** — Processor ecosystem; sources: P1.
- **Zoho CRM / One** — Horizontal suite; sources: Z1, Z2.
- **HubSpot Customer Platform** — Horizontal suite; sources: H1, H2.
- **Salesforce Sales Cloud** — Horizontal CRM; sources: S1.

This is a vendor feature-evidence comparison, **not** a hands-on product test, independent security audit, user-review study, or price/ROI validation. Features may be edition-specific. Open questions must be answered by demonstrations, contracts and buyer interviews.

## 2. Evidence classification

- **D** = vendor **explicitly advertises** this capability in the linked pages; not independently verified or confirmed in every price plan.
- **A** = an adjacent/partial capability is described, or the same vendor provides it in a separate product. Not proof of the exact functionality or entitlement.
- **?** = not verified from the reviewed sources. **Never interpret ? as absence**.
- This matrix contains *competitor-marketed products*; **Zoho Clone is still a roadmap and has not built these features.**

## 3. Capability matrix (29 rows)

| Capability | Planned phase | NMI | ISOhub | PayHub | Zoho | HubSpot | Salesforce |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Unified suite admin and app licensing | P4/P6 | ? | ? | ? | D | D | A |
| Lead, contact and account management | P5 | D | D | A | D | D | D |
| Deal pipeline and stage management | P5 | D | D | A | D | D | D |
| Tasks and follow-up workflows | P5/P7 | D | D | A | D | D | D |
| Merchant portfolio and MID records | P8 | D | D | D | ? | ? | ? |
| Agent/sub-agent hierarchy management | P8/V1 | A | D | A | ? | ? | ? |
| Agent or reseller self-service portal | V1 | A | D | D | ? | ? | ? |
| Merchant application status tracking | P8 | D | D | D | ? | ? | ? |
| Configurable onboarding checklists | P8/V1 | D | D | A | A | A | A |
| Merchant digital document capture | V1 | D | D | A | A | A | A |
| eSign of merchant processing application | V1 | D | ? | ? | A | A | A |
| Direct processor boarding integration | P7/V1+ | D | D | A | ? | ? | ? |
| Automated KYC/KYB/risk underwriting | Specialist V2+ | D | A | D | ? | ? | ? |
| Residual statement import and mapping | V1/V2 | D | D | A | ? | ? | ? |
| Commission splits and overrides | V2 | D | D | ? | ? | ? | ? |
| Residual payout execution | Specialist V2+ | D | A | ? | ? | ? | ? |
| Merchant/agent portfolio analytics | P8/P11 | D | D | D | A | A | A |
| Support tickets linked to customer records | P15 | D | D | D | A | D | A |
| White-label merchant-facing portal | V2/P16 | D | ? | A | A | ? | ? |
| Email and call sales engagement | P7/V1 | D | A | A | D | D | D |
| Workflow automation and routing | P7/V1 | D | D | A | D | D | D |
| Agent/mobile field functionality | V1/V2 | ? | D | ? | D | D | D |
| POS terminal/hardware tracking | P15/POS | ? | D | ? | ? | ? | ? |
| Cross-product marketing/HR/finance suite | P15-P17 | ? | ? | ? | D | D | A |
| AI-assisted sales or portfolio insight | P10 | D | ? | A | D | D | D |
| Public API/developer extension ecosystem | P17 | ? | ? | ? | D | D | D |
| Bulk CRM data import and export | P5/P7 | A | D | ? | D | D | A |
| Multi-tenant isolation and audit proof | P4/P12 | ? | ? | ? | ? | ? | ? |
| Customer subscription entitlements | P6 | ? | ? | ? | ? | ? | ? |

### Interpretation rules

1. An 'A' for a general-purpose CRM means customization may be possible; it does not demonstrate the presence of a ready-made ISO workflow.
2. An 'A' for PayHub does not prove the feature is separately licensable outside the SignaPay processor partner relationship.
3. Vendor advertisements of security, integrations, residual accuracy or AI are not proof of implementation quality or contractual access for our company.
4. Pricing and total deployment time are **not scored**. Reliable comparable quotes, onboarding costs, seat/merchant limits and contractual conditions require sales conversations.
5. The absence of evidence from one page **never establishes a feature gap**. Record any gap only after checking official full docs, demos and appropriate evaluations.

## 4. Important competitive findings

### Direct payment-industry competitors are already feature-rich

- NMI Merchant Central advertises payment-sector CRM, application onboarding, processor boarding, KYC/KYB-related risk tooling, residual calculation and payouts, analytics, support, and white-label portals. Sources N1-N4.
- ISOhub advertises ISO-specific agents, merchant boarding, residual split rules, documents, ticketing, inventory and reporting. Sources I1-I2.
- PayHub offers the SignaPay partner ecosystem merchant onboarding, merchant/transaction/residual reporting, support and underwriting checks. Source P1.

**Conclusion:** 'One CRM for leads, agents and merchants' is not a verified market gap. Our first product must compete through a **measurable, customer-specific advantage**.

### Horizontal competitors set a high bar for standard CRM

Zoho, HubSpot and Salesforce explicitly market lead/contact/deal management, automated follow-ups, reporting and substantial AI capabilities. Zoho One and HubSpot also emphasize integrated applications (Z1/Z2/H1/H2/S1).

**Conclusion:** Standard CRUD CRM functionality is necessary for the platform but insufficient by itself as a defensible product offer.

## 5. Evidence-based differentiation hypotheses to test (NOT validated claims)

| Hypothesis | How to test with buyers | Decision threshold / evidence | Scope impact |
| --- | --- | --- | --- |
| Simpler first-time configuration | Ask ISO ops team to configure example agent and application flow in incumbent and prototype | Observe task time/errors with comparable user tasks; no invented baseline | P2 usability, P4 configuration, P8 templates |
| Faster migration from spreadsheets | Ask for anonymized real schema/sample and import into prototype | Count required cleanups and successful mapping, compare existing migration effort | P5/P7 imports |
| Lighter onboarding-only layer alongside existing software | Interview teams already using NMI/ISOhub/processor tools; confirm system of record vs. overlay | At least several buyers agree tracking-only utility has paid value | P8 core, P7 adapters later |
| Transparent app/seat/agent pricing | Request total-cost-of-ownership quotes for comparable customer size/usage | Consistent buyer frustration with existing buying model, budget approval potential | P6 billing |
| Better restricted agent visibility | Demonstrate hierarchy/record ownership with real roles and tenant rules | Buyers can perform needed job with fewer manual workarounds, approved security | P4 policies, P8, V1 portal |
| Faster access to actionable onboarding bottlenecks | Pilot KPI examples (stalled applications, ownership, handoff age) | Customer can define and measure a concrete operational improvement | P8 reporting/P11 |
| Modular future-suite adoption | Verify desire to add CRM, Support, Projects, Finance modules without re-entering contacts | Multiple customers actively want a relevant second app; not just a hypothetical yes | P9/P15+ |

There is currently **no evidence that our product will outperform any incumbent**; these tests must decide whether the differentiation thesis survives.

## 6. Capability-to-delivery sequence

| Release | Required capabilities | Why now |
| --- | --- | --- |
| P4 foundation | Identity, organizations, tenant isolation, RBAC, audit, app catalog | Sensitive business data separation is prerequisite |
| MVP P5 | Leads, accounts, contacts, pipelines, deals, tasks, filtered exports | Sales lifecycle foundation |
| MVP P6 | Organization subscription and enforceable entitlements | Commercial readiness |
| MVP P7 | Event outbox, imports, notification/email adapters and basic automation | Operational handoffs |
| MVP P8 | Merchant records, agent assignments, application statuses, checklists and KPIs | First industry-specific value |
| V1 | Configurable agent portals, file workflow, support tracking, first permitted processor connector | Only if pilot use demonstrates priority |
| V1/V2 | Residual file importer, exception handling and reconciliation | Requires actual redacted statement examples |
| V2 | Commission engine, contract-based splits, audit and payout approvals | Specialist financial verification; no silent automated payouts |
| V2+ | White-label merchant portal, risk/underwriting integrations, advanced analytics | Requires security/commercial agreements |
| P15-P17 | Zoho-like apps, enterprise governance, developer platform and IT tools | Reuse shared platform only after proven demand |

### Architectural constraint

Nothing in P0.03 changes the chosen stack: **Next.js/React/TypeScript + Tailwind/shadcn frontend, Node.js/Express/TypeScript backend, PostgreSQL/Prisma, Redis/BullMQ as needed, REST/OpenAPI, modular monolith**.

## 7. Buyer competitive interview script (prepare here; execute during P0.04)

1. Which CRM, processor portals, agent systems and residual tools do you use? Record product/edition.
2. Show one *anonymized* application from inquiry to activation. Where are handoffs or delays?
3. Does the system support agent hierarchies, reporting and portal access today? What is manual?
4. Which supported processor integrations do you actually use? Are there setup or licensing fees?
5. How do merchant applications and document collection work, including signatures and rejected steps?
6. How are residual statement files mapped, reviewed, adjusted and paid? Who signs off?
7. Which internal support operations are linked to merchant records, and what is disconnected?
8. What slows onboarding new employees or importing merchants into the incumbent system?
9. What is your true total cost including modules, users, integrations, implementation and support?
10. Would you buy a narrower product **without** direct processor boarding/residuals? If not, what exact minimum replaces that assumption?
11. What security documents, data residency, SSO, access controls and procurement steps are required before a pilot?
12. Who has budget authority, what event would trigger switching, and what would a measurable successful pilot mean?

Document negatives as carefully as positives. Avoid leading questions and unsupported customer quotes.

## 8. Commercial competitive checks still open

- [ ] Acquire comparable vendor quotes/terms for 10-, 25- and 75-seat ISO examples. Do not make up values.
- [ ] Check contracts, onboarding fees, minimum commitments, external seats and processor access prerequisites.
- [ ] Test vendor demos hands-on with comparable anonymized workflows when legitimately available.
- [ ] Verify whether a lightweight overlay product is feasible alongside existing incumbent systems.
- [ ] Validate at least three concrete differentiators with independent buyer evidence.
- [ ] Evaluate customer migration effort and third-party data export rights.
- [ ] Assess security/data obligations with legally suitable reviewers when sensitive workloads arise.

## 9. P0.03 acceptance and review

- [x] Six relevant competitor/ecosystem providers mapped.
- [x] 29 feature-by-feature comparison rows with explicit evidence status.
- [x] Official vendor sources and research limitations documented.
- [x] Roadmap-phase mapping and proposed differentiation tests.
- [x] P0.04 interview questions and outstanding commercial evidence listed.
- [ ] Product owner reviews and approves the competitive priorities/gap interpretation.
- [ ] Resolve any factual issues in source evidence before P0.03 closure.

**Current outcome:** Draft prepared, P0.03 **in progress**. We have not performed product demos, prospect interviews or access-controlled API tests. Proceed to P0.04 only after the phase approval gate.

## 10. Official source register

See [competitive-evidence.md](competitive-evidence.md). All findings must be rechecked for major release decisions because vendor products and packaging change.

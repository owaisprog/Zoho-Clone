# P0.08 — Pricing Hypotheses and Buyer Interview Protocol

**Project:** Zoho Clone
**Date:** 2026-11-13
**Status:** RESEARCH PACKAGE PREPARED; **0/5 qualified pricing interviews** and **no approved selling prices**.
**Issue:** https://github.com/owaisprog/Zoho-Clone/issues/11
**Dependency:** P0.07's measurable value hypothesis not verified. This document is parallel preparation at owner's request, not evidence of passed P0.07.

## 1. Who pays / what is sold
The SaaS customer is the ISO / merchant-services or POS/payment company, **not the individual merchant**. Initial offering is an internal CRM + merchant application tracking layer with shared users/roles and hosted subscription billing. General Zoho-like products are separate future modules or bundles; **no suite is built now**.

## 2. Pricing dimensions to validate
| Dimension | Options to ask about | Core risk |
|---|---|---|
| Billing unit | Per organization + included internal users; per active internal seat; optional agent portal users later | Companies may have many external agents but few employees |
| Starter baseline | CRM leads/accounts/deals and limited internal merchant workflow | Low perceived differentiated value |
| Growth expansion | Multi-user onboarding queues, stage history, permissions, dashboards | Security/data migration cost |
| Scale / enterprise | More internal users, advanced controls, API/SSO later, managed onboarding | Enterprise procurement may exceed MVP scope |
| Setup fee | None vs one-time onboarding/migration for verified services | Migration and support effort could erase margin |
| Integrations | Flat per approved connector or usage-priced after contracts | Actual processor API availability and cost unknown |
| Data/import volume | Reasonable included limits + transparent expansion | Uncontrolled file storage/support and import risks |
| Billing term | Monthly or annual with transparent cancellation/export | Annual commitments before value validation can deter adoption |

### Illustrative price *test anchors*, not an approved offer
**Organization/month hypotheses:** Starter **$149**, Growth **$399**, Scale **from $999**. These were proposed in the earlier P0.01 charter. They are **not competitor-equivalent quotes, current product prices, or validated willingness to pay**. Company-size, included seats, feature limits, setup fees and support must be defined/tested before any price can be published.

Do **not** publish a three-tier price table yet. Use neutral current-spend and trade-off discovery first, followed by optional price testing. Ask buyers about actual recent software purchases, budgets and lost value, rather than treating polite approval of an invented number as proof.

## 3. Published public competitor references (checked 2026-11-13)
| Provider/edition | Public headline anchor (USD, US pricing page) | Commercial caveats |
|---|---|---|
| Zoho CRM Standard | **$14/user/month, billed annually** | US edition headline; actual tax/add-ons/multi-product bundle costs vary |
| Zoho CRM Professional | **$23/user/month, billed annually** | Not an out-of-box ISO boarding or residual product comparison |
| Zoho CRM Enterprise | **$40/user/month, billed annually** | CRM capability and edition limits differ |
| HubSpot Sales Hub | Pricing page lists Starter promotional **$7/seat/mo** and standard **$20/seat/mo**; Professional **$90–100/seat/mo** | Page shows conditional discounts, onboarding fees and complex seats; do not treat teaser promo as permanent |
| Salesforce Starter Suite | **$25/user/month** | Sales CRM starter, not ISO-specific workflows |
| Salesforce Pro Suite | **$100/user/month billed annually** | Other enterprise editions much higher; individual seat cost not the whole workflow |
| NMI Merchant Central | No comparable **verified standardized quote** in current research | Modular merchant onboarding, reporting/residual feature scope requires direct quote |
| ISOhub / SignaPay partner portals | No comparable **verified standardized quote** collected | Bundles may depend on processor/partner relationship |

Official sources (verify before quoting): 
- https://www.zoho.com/en-us/crm/zohocrm-pricing.html
- https://www.hubspot.com/pricing/sales
- https://www.salesforce.com/sales/pricing/
- https://www.nmi.com/products/merchant-central/

**These are public vendor list prices**, not price quotes for equivalent merchant-onboarding workflows. Currency, billing cadence, discounts, taxes, support and implementation differ. Do not claim our proposed SaaS is cheaper.

## 4. Minimum five-buyer evidence plan
Interview at least **five qualified economic buyers** (prefer 3 ISO, 1 POS provider, 1 PayFac or another independent ISO) who can influence budget or approved purchasing. The five must not all represent one company. No interviews have been conducted.

### Neutral script
1. Which tools and subscriptions have you paid for to manage leads/agents/merchant boarding in the past year?
2. Who signs software agreements and how long does it take to purchase?
3. What are your current monthly/annual software plus onboarding/integration/support costs, if you're willing to share?
4. How many internal users, external agents and active merchants would need access? Which must be paid users?
5. Which current tools must remain because of processor contracts or workflow dependencies?
6. Which workflow would justify a paid tool even without direct boarding/residual payouts? Describe the last occurrence.
7. What measurable change would justify spending money? How would you check it?
8. If you had to choose, which capabilities are worth giving up to reduce spend?
9. What price/terms would you **reject immediately** and why? Which would need procurement review?
10. Would you spend money on a 30–60 day pilot, under what security/integration conditions, and who could approve it?

Only after their unprompted spending/current alternative discussion: show **one randomized hypothetical plan** and ask them to choose between realistic tradeoffs, including **"buy neither"**. Avoid leading "wouldn't you pay $399?" wording.

## 5. Price ladder/conjoint-lite experiment
Randomize presentation of three nonbinding alternatives (no current offer):
- A: organization base plus 5 internal seats, tracking features, no live processor integration;
- B: organization base plus 15 internal seats and operational dashboards, no processor integration;
- C: organization base plus 30 internal seats, advanced control/support *subject to later engineering*, no payment-processing capabilities.

Record price acceptance/refusal, feature prerequisites, budget authority and evidence grade. Refusal to consider **any** tracking-only tier is material negative evidence. Ask respondents to rank A/B/C/**none**, then evaluate thresholds, without asserting that acceptance equals intent to purchase.

## 6. Basic unit economics — variables not invented outcomes
Monthly revenue = base subscription + incremental seats + valid add-ons - applied credits/refunds. 
Estimated **gross margin** = (recognized recurring revenue - hosting/DB/storage/billing fees/support/AI/API and directly attributable delivery costs) / recurring revenue.
**Pilot CAC payback** = sales+implementation acquisition spending / expected monthly gross profit per customer.
Compute at 5, 15, 30, 75 internal seats, different active merchant volumes and setup costs **once supplier quotes exist**. Do not state ROI or profitability until actual costs and churn data exist.

## 7. P0.08 acceptance and shortfall
- [x] Commercial units, plan alternatives and experimental anchors described.
- [x] Five-buyer, neutral evidence design and feedback capture schema written.
- [x] Public competitor pricing pages logged with non-equivalence caveats.
- [x] Financial variable model and open supplier costs documented.
- [ ] **At least five qualified buyers actually tested** the offer: **0/5**.
- [ ] Owner decides publicly sellable price/seat plans after evidence: **not approved**.
- [ ] Evidence reviewed or explicit owner risk waiver recorded.

**Status: PREPARED / NOT VALIDATED.** Private buyer names/spend/quotes must not be committed to public GitHub.

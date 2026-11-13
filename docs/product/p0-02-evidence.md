# P0.02 - Public Evidence and Assumptions Log

**Compiled:** 2026-11-13
**Status:** External desk research only. No prospect interviews, verified prices, sales commitments or proprietary company data.

## Source 1 - NMI Merchant Central (official product page)

- **URL:** https://www.nmi.com/products/merchant-central/
- **Observed:** NMI advertises Merchant Central (formerly IRIS CRM) for ISOs, banks, and software providers, with merchant pipeline, signup/onboarding, underwriting tools, processor boarding, portfolio reporting, residual management, helpdesk and white-label portal.
- **Supports:** The category exists, its workflows are commercially productized, and a named incumbent provides many advanced capabilities.
- **Does not prove:** That any specific merchant services company is unhappy or will pay for our proposed product.
- **Implication:** Compete through a validated workflow advantage, not the unsupported claim that no competitor offers merchant CRM.

## Source 2 - NMI merchant boarding (official product page)

- **URL:** https://www.nmi.com/products/merchant-central/merchant-boarding/
- **Observed:** Processor-specific onboarding requirements and multiple named processor integrations are described.
- **Supports:** Direct processor boarding is a distinct and technically complex workstream beyond generic tracking.
- **Does not prove:** API access or commercial integration rights are available to our project.
- **Implication:** Keep direct boarding out of MVP and require formal partner/API discovery in later phases.

## Source 3 - NMI residuals (official product page)

- **URL:** https://www.nmi.com/products/merchant-central/residuals-management/
- **Observed:** Residual reporting may use processor data, split/bonus rules, reconciliation, payouts, and exception handling.
- **Supports:** Residual management requires separate financial domain models and auditable calculations.
- **Does not prove:** Specific residual formats or financial rules used by our potential clients.
- **Implication:** Treat residual imports and a calculation engine as separate later workstreams.

## Source 4 - Clover partner education (official)

- **URL:** https://partners.clover.com/bankeredu/home/
- **Observed:** Clover partner-facing resources describe POS solutions, merchant account enrollment and payment hardware/software offerings.
- **Supports:** POS sales and merchant enrollment coexist in partner workflows.
- **Does not prove:** A particular reseller needs our CRM or the economics of the opportunity.
- **Implication:** POS reseller ICP is adjacent but likely requires terminal/installation capabilities to validate.

## Source 5 - Stripe guide to PayFacs (official)

- **URL:** https://stripe.com/guides/payfacs
- **Observed:** Traditional PayFacs can carry submerchant onboarding, KYC/AML, monitoring, compliance and payment responsibilities; precise duties vary by region and payment model.
- **Supports:** PayFac work is a more complex/risk-sensitive initial segment.
- **Does not prove:** A specific vendor's contract or a universal legal requirement for our software.
- **Implication:** Do not assume generic merchant onboarding software provides compliant PayFac underwriting or fund handling.

## Source 6 - Clover developer partnership (official)

- **URL:** https://docs.clover.com/dev/docs/application
- **Observed:** Clover documents an application and technical discovery process for certain integration partnerships and product-policy obligations.
- **Supports:** Not all POS/processor integrations are instantly available without approval.
- **Does not prove:** Our eligibility for partner integration.
- **Implication:** Treat technical/commercial integration access as a discovery dependency.

## Evidence quality rules

- Official vendor pages are **competitor and workflow evidence**, not independent customer surveys.
- No quantifiable TAM, market share, conversion rate or competitor price has been independently validated in P0.02.
- All company-size bands, price sensitivity ratings, buyer accessibility ratings, and weighted totals in `icp.md` are **provisional internal judgments**.
- Direct customer validation occurs in P0.04 and P0.05; revise ICP scores if results contradict the assumptions.
- Dates are research compilation dates; if a source page changes, capture new evidence and update this log.

## Source-to-requirement links

| Source | Planned capability affected | Roadmap dependency |
| --- | --- | --- |
| Merchant Central core | CRM, agent, merchant and application lifecycle | P5/P8 |
| Merchant Central boarding | Processor connector adapter and secure documents | V1+/P7/P15 |
| Merchant Central residuals | Reconciliation, residual engine | V1/V2 |
| Clover partner resources | POS reseller merchant deployment flows | Future POS operations track |
| Stripe PayFac guide | Data classification, compliance boundary | P0/P1/P12/P16 |
| Clover partner rules | External API access and integration agreements | P7/P15 |

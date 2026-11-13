# P1.09 — Coverage, Evidence and Implementation Gap Register

**Version:** 1.0 — owner-approved P1.09 gap baseline · 2026-11-13  
**Status:** P1.09 owner approved this gap tracking as **PLANNING ONLY** on 2026-11-13. **ALL 14 G-001..G-014 REMAIN OPEN**; no unsupported PASS/READY/CERTIFIED claims.  
**Sources:** [121-row requirement coverage](requirements-coverage.csv), [36-row feature coverage](feature-coverage.csv), [727-case planned test inventory](test-inventory.csv) and [P0 debt issue #8](https://github.com/owaisprog/Zoho-Clone/issues/8).

## 1. Exact coverage findings

| ID | Scope/gap | Verified documentary finding | What remains to be done | Next owner/workstream | Block type |
|---|---|---|---|---|---|
| G-001 | Actual executable app | `frontend/` and `backend/` remain README placeholders; no runnable Next.js/Express integration | P3 scaffold, P4 tenant/auth foundation, actual test runner/CI and executed cases | P3/P4 | HARD for any functioning demo |
| G-002 | No measured tests | **0 of 727** planned tests run; **0 recorded passes** | Build tests and capture run evidence; distinguish FAIL/BLOCKED/SKIPPED | P3–P12 | HARD for G-INT |
| G-003 | Permission matrix runtime | 286 proposed decisions (69 allowed, 217 default denied); none server enforced | Implement central policy and tenant+record+field checks; execute 286 data-driven tests plus 52 abuse cases | P4/P12 | HARD for G-INT/G-EXT |
| G-004 | API & event delivery | 67 proposed HTTP operations and 16 internal event types; no actual server/outbox/queue | Implement schema validation, tested API auth/session/cursor/CSRF, outbox and idempotent consumers; run 164 API and 32 event checks | P3/P4/P7/P8 | HARD for affected slices |
| G-005 | UI-only and deferred PRD | Direct API coverage **18/26** UC and **37/49** FR | Link `UC-106` and `UC-208` to UX/QA cases; keep `UC-301..306` deferred, with non-availability tests. Other FRs need policy/error/recovery rather than invented endpoints | P1.09/P2/P3 | Documented intentional non-route scope |
| G-006 | Feature-specific tests | 36/36 features link to planned tests, often through shared UC/FR (not individually independent test per feature) | Add executable scenario coverage per feature, including 7 features without direct API routes; verify dependency order and feature exclusions | P2/P3–P12 | HARD for per-feature implementation signoff |
| G-007 | External processor states | Internal merchant stages are unvalidated; status `DEMO_ONLY_*` synthetic/unverified | Qualified ISO/POS/PayFac operator validation (P0.05 0/3); agreements, secure adapter design and independently verified status rules | Business owner/P8 | HARD for external provider capability |
| G-008 | User market/pricing/pilot proof | 0 buyer interviews, 0/5 pricing buyer interviews, 0/2 pilot commitments | Independent proof; decide whether to sell, price or enter trials based on actual evidence | Business owner | HARD for G-EXT/G-COM |
| G-009 | Privacy/security/legal readiness | Data classification/denial and future audit specified; no implemented controls or certification | Record/data lifecycle, DPAs, legal entity/jurisdiction, secure hosting, secret hygiene, logging, risk assessment and security review | P12/P14/legal reviewer | HARD for G-EXT/G-COM |
| G-010 | NFR/recovery/accessibility | 46 target NFRs with 52 planned tests; no benchmarks, backups/restores or WCAG assessment | Actual 25-VU load with environment data; backup/restore RPO/RTO evidence; keyboard/screen-reader checks; no unsupported SLA | P12/P13/P14 | HARD for external launch |
| G-011 | Domain/API semantics not frozen | 31 entities, 230 proposed fields, 33 relationships, 68 fictional examples; exact IDs, permission projections and ISO stage names provisional | Refine entity keys, type/field mapping, enrollment, raw-data exclusions, cross-tenant integrity, lifecycle and API schema as implementation begins | P1.10/P3/P4 | CONDITIONAL DESIGN |
| G-012 | Commercial/subscription and real integrations | Mock billing only, no live provider contracts or published prices | Owner chooses billing vendor, legal terms and required financial controls; design future integration per agreement | Product owner/P6/P7 | HARD for G-COM |
| G-013 | Automated report/test reconciliation | Written tests cannot prove consistent tenant aggregations | Verify report filters/counts, query limits, background jobs, exports and recusal of revoked identities on running database | P5/P8/P12 | HARD for G-INT |
| G-014 | Audit/CI evidence provenance | 727 planned test IDs have no test file, runner, execution job or redacted log link | Record actual source code path, commit, run ID, environment, status and artifacts once executed | P3 onward | HARD for implementation claim |

## 2. Important coverage distinctions

- **121/121 planned-test reference coverage** does not mean 121/121 requirements are *verified*, fully specified for all positive/negative permutations, or implemented.
- **36/36 features linked to future test IDs** includes indirect shared UC/FR coverage; a linked test may not exercise every feature-specific constraint.
- **727/727 cases registered as NOT_RUN** means there are **no measured product results**. The 286 policy decision tests check expected role/resource defaults, but concrete record/field scopes still need more detailed implementation-level test data.
- **67 API operations documented** does not mean an Express server or live OpenAPI endpoint exists. **16 event types** do not mean events have been delivered.
- **0 qualified research** means synthetic journeys and stage terminology cannot be described as market-validated.
- **P0.10 internal conditional GO** never authorizes G-EXT or G-COM, sensitive raw financial/identity data, real processor boarding, paid subscriptions or customer trial.

## 3. Closure rules for the gaps

The P1.09 documentation phase can be approved without resolving these implementation and external-evidence gaps, provided **they remain open, assigned and accurately labeled**. Actual G-INT release acceptance requires executing tests and closing/blocking relevant technical risks. G-EXT/G-COM require separate explicit permission, proven safeguards, real partner/buyer constraints and commercial/legal decisions.

P1.10 now carries each of the **14 OPEN** gap IDs into [the P1.10 risk register](../product/p1-risk-register.csv) and [risk narrative](../product/p1-risk-register.md). **None has been mitigated or closed by P1.09 approval**; evidence and security obligations remain open until independently verified.

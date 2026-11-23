# P4 Batch 21 — Original P1.09 acceptance traceability integrity

Date: 2026-11-23. Draft, stacked on verified Batch 20. This batch adds traceability and negative tests, **not** formal P1.09 execution.

## Five implemented tasks

1. **Link partial engineering evidence to real planned test IDs:** `docs/qa/p4-engineering-evidence-links.json` records 12 explicitly selected original case IDs such as `AC-050`, `AC-053`, `PERM-T008`, `J-02-NEG` and `API-T012-NEG`, each with a real local CI test or smoke path, precise limitation, `CI_ONLY_PARTIAL` classification, `NOT_RUN_DOCUMENT_ONLY` original state and `ownerAccepted=false`. These links are examples of related technical work, **not equivalent product acceptance proofs**.
2. **Validate the unchanged original acceptance inventory:** `scripts/p4-acceptance-traceability.mjs` parses quoted RFC4180 CSV records, verifies the original 727 planned rows, schema, unique IDs and untouched `NOT_RUN_DOCUMENT_ONLY` status, plus the P4 feature-to-test references in `docs/qa/feature-coverage.csv`.
3. **Deny misleading evidence:** the same evaluator rejects missing/duplicate/foreign acceptance case IDs, invented executed cases, production scope, forged owner acceptance, disallowed evidence paths, and missing source references; returns `NO_GO` even when all links are valid.
4. **Automate regression testing:** ten Node tests cover CSV escapes, malformed inventory, duplicate/omitted IDs, traceability drift, falsified original execution status, partial-evidence restrictions and missing files.
5. **Run as a mandatory CI safety check:** the new script and its tests execute with the existing build, typecheck, security checks, restricted PostgreSQL/Prisma/HTTP integration, and Phase 4 formal gate validation.

## Distinguishing evidence and acceptance

The **727 original P1.09 planned cases remain 0 executed**. Running additional unit or synthetic PostgreSQL checks does not increase the formal acceptance counter. Some linked CI tests verify narrow, related security behavior but not the complete original cases, which may require live Auth0, user journeys, provider integrations, real authorization review or staging setup. The manifest documents that limitation per link.

Formal release remains **NO_GO**. Ten Phase 4 owner/production gates, R10-C1–C5, 14 risk items, 12 decisions, live Auth0/MFA, production RLS/credential design, storage/scanning/retention, P2/P3 staging approval and P4 owner exit are open. No customer data, owner Neon migrations, main branch merge, production or staging deployments were performed.

CI status: pending at initial authoring; only report green after GitHub Actions confirms.

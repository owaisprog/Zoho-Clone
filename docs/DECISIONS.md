# Project Decision and Change Log

**Change policy:** Each meaningful scope, architectural, security or deployment change is recorded here with date, alternatives, decision, rationale and approval. Work is verified in GitHub, CI and preview links.

| ID | Date | Decision | Status | Rationale |
|---|---|---|---|---|
| DEC-001 | 2026-11-12 | Build a modular, multi-tenant branded business suite rather than copy Zoho UI/code | Accepted | Original project goal |
| DEC-002 | 2026-11-12 | ChatGPT-led implementation; user acts as product owner | Accepted | User will not hire a developer team |
| DEC-003 | 2026-11-12 | `main` remains release branch; work on `develop` and review PRs | Accepted | Prevent unreviewed production changes |
| DEC-004 | 2026-11-12 | Use MerchantOps CRM for payment-industry firms as initial wedge | Proposed / validate in P0 | Focused entry to larger suite |
| DEC-005 | 2026-11-12 | Next.js + NestJS + PostgreSQL modular monolith | Provisional | Good first-stage modularity without distributed-systems overhead |
| DEC-006 | 2026-11-12 | Start with P0 research and evidence gate, then P1 requirements | Accepted | Reduce cost of building the wrong product |

## Current execution status
- Repository: `owaisprog/Zoho-Clone`.
- Branch: `develop` created from `main`.
- First changes: documentation only; no application code, CI, tests or deployment yet.
- Current phase: **P0 in progress**.
- Real validation: **not completed**.
- Security/privacy production approval: **not completed**.

## Future change template
```
### DEC-NNN — Short title
Date:
Status: Proposed | Accepted | Rejected | Superseded
Problem:
Alternatives:
Decision:
Reasoning:
Affected phases/files:
Security/privacy impact:
User approval reference:
Verification:
```

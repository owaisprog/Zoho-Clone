# P4 Batch 37 — visible recipient invitation demo and lifecycle usability

Date: 2026-11-24. Stacked on verified Batch 36. Five feature-work subphases:

1. **Recipient inbox and summary selectors** in `frontend/src/lib/p4-functional-workflow.ts`: typed browser-memory invitation totals (pending, accepted, revoked, expired, active members) and recipient-email filtered inbox confined to the currently selected fictional organization. Input validation, immutable results, strict example.com limitation.
2. **Recipient-perspective acceptance transition**: `acceptSandboxInvitationAsRecipient` checks exact fictional recipient email and pending/unexpired status, then adds the fictional sales member using the existing pure transition. Wrong emails, wrong organizations, expired/revoked invites and replay are denied. **Typed email is NOT identity authentication** and this helper must NEVER authorize a real invitation.
3. **User-visible Next.js UI and navigation**: `frontend/src/components/p4-functional-workspace.tsx` now has owner invitation status totals, status filters, owner revoke controls, a separate fictional recipient inbox and simulated acceptance action. `workspace-shell.tsx` links the page in sidebar; `p4-memberships.css` adds responsive status/filter styles. Existing `/app/organization/workflow` page continues to label the feature as a browser-memory prototype.
4. **Nine new behavioral tests** cover cross-tenant visibility, exact recipient binding, invitation-state transition, duplicate acceptance, wrong email, expiry, revoked invite, summary totals, and absence of secret state. The existing R27 browser-memory tests still cover owner protection, workspace creation, switching, membership revocation and caps.
5. **CI production-isolation guard** `scripts/p4-r37-browser-boundary.mjs` refuses fetch/WebSocket, storage/cookie access and real API URLs anywhere in the demo UI/model/page. Full frontend build, TypeScript, backend regression, test inventory and existing disposable PostgreSQL signed-token integration must still pass.

## Scope and formal acceptance

This is an **actual clickable user-facing Next.js feature demo** that persists only in memory until refresh. It is intentionally **not** the production invitation issuance, authentication or database persistence workflow. The R34 real frontend API client remains CI-only and is not imported into the normal Next.js page. No Auth0 session grants access to fictional inbox; typing a demo email is not a security check. Do not attach live merchant data, SMTP, KMS, Neon writes or staging access.

Original 727 P1.09 acceptance cases remain 0 formally executed, status NO_GO, with 38 partial technical links; all ten release gates, 14 original risks, 12 decisions, R10-C1–C5 and exit issue #61 remain open. No merge, Neon migration, staging or production deployment.

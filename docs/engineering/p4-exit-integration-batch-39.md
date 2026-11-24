# P4 Batch 39 — fictional membership administration and safe reactivation

Date: 2026-11-24. Development only, stacked on P4 Batch 38.

## Five engineering subphases

1. Add a selected-organization-only, immutable member directory with deterministic sorting, email/role search and active/revoked filters.
2. Add bounded fictional owner-side role changes between SALES_REP and SALES_MANAGER. Reject owner edits, unknown/revoked/duplicate members, no-op updates, invented roles and invalid timestamps; no server permission is conferred.
3. Add a selected-organization-only 30-event in-tab role history. Events use immutable fixed fields and fictional @example.com identities only. **Not a trusted audit log**.
4. Add responsive Next.js member search, status selection, role editor and history timeline within the existing functional invitation workflow, with conspicuous demo-only disclosure.
5. Fix prior revoked-manager reactivation so any fresh accepted SALES_REP invitation restores SALES_REP, not the previously elevated role. Add twelve regression tests, mandatory CI contract script and this engineering report.

## Boundaries and acceptance

All changes are restricted to the frontend's fictional browser-memory model and presentation, guarded by existing no-network/no-storage checks. R34's real signed localhost CI HTTP and disposable PostgreSQL integration are unchanged; do not wire this UI to them without fresh real identity authorization, owner approval and security acceptance.

No Auth0/JWKS/MFA provider validation, real SMTP, managed KMS, production Neon modification, customer data, staging or production deploy, or main branch merge is authorized.

Original P1.09 formal cases: **727 documented / 0 executed**. Phase 4 decision: **NO_GO**; 10 release gates, 14 original risks, 12 unresolved decisions, R10-C1–C5, and exit issue #61 remain OPEN.

CI evidence must be confirmed on the exact final PR head before this batch can be declared verified.

# Phase 4 — Batch 27: functional organization and membership sandbox

Date: 2026-11-23. Stacked on verified Batch 26. **Feature-development batch** rather than an additional CI-only acceptance-evidence mapping batch.

## Five implemented feature deliverables

1. **Actual stateful organization creation:** `frontend/src/lib/p4-functional-workflow.ts` adds a pure, immutable functional state machine to create fictional organizations, reserve unique demo slugs, assign an active demo ORG_OWNER, prevent duplicates and cap workspace count. All state stays in the current browser tab's React memory, not a backend or database.
2. **Working organization selection, invitation creation, acceptance and revocation:** the same engine supports switching separate fictional workspaces, creating bounded pending invitations for `@example.com` accounts, expiry calculations, a simulated acceptance that adds a demo SALES_REP, invitation revocation and sales-member deactivation while retaining the owner. Illegal transitions fail closed with typed errors.
3. **Visible interactive React workflow:** `frontend/src/components/p4-functional-workspace.tsx` and `frontend/src/app/app/organization/workflow/page.tsx` expose controlled forms, accessible status feedback, selected-workspace detail, member list, invitations and action buttons. New responsive styles reuse P2.01 tokens.
4. **Real navigation and feature integration:** the existing `/app/organization/memberships` page now provides an entry to `/app/organization/workflow`. The previous nonworking previews remain available for design reference. Functional actions update the rendered in-tab records immediately.
5. **Functional acceptance-oriented automation:** 12 tests in `frontend/test/p4-functional-workflow.test.ts` exercise create, unique slug, owner membership, two-workspace switch isolation, invitation pending/accepted/expired/revoked transitions, no membership until simulated acceptance, owner continuity, forbidden recipient, bounded count and malformed transitions. Existing GitHub Actions frontend test/typecheck/build jobs run these automatically.

## Honesty and deployment scope

This is a **working user-interface and state-transition prototype**, not a full-stack tenant-onboarding service. The flow does not send mail, make API calls, store data, implement live Auth0, create a database tenant, issue secure redemption tokens or authenticate actual users. The controls explicitly say acceptance is **simulated**, and refresh clears state. Browser memory is not a security boundary; the server-side APIs remain intentionally unmounted pending identity, RLS and production approvals.

No original P1.09 case was automatically marked passed. The original **727 cases remain NOT_RUN_DOCUMENT_ONLY (0 executed)**, and formal release remains **NO_GO** with 10 open exit gates, 14 original risks, 12 decisions, R10-C1–C5 and owner signoff pending. No main merge, Neon migration or staging/production deployment.

## Next required feature integration

Connect the approved UI to a server-side organization/invitation transaction service and real Auth0 verified identity, then test true persistence and invitation redemption against a least-privilege staging PostgreSQL role. Those steps require security and owner approvals; this batch does not claim them.

CI verification pending at authoring. Final test totals and run appear in draft PR after Github Actions verification.

# P4.21–P4.25 — Batch 05: file lifecycle, notifications, admin, support and closure

**Reference:** Owner-uploaded Zoho Clone AI Master Roadmap (Express.js Final), pp. 37–39. The scope and acceptance lines below correspond to P4.21–P4.25 in the PDF.
**Status:** Synthetic-only TypeScript contracts, negative tests, fictional Next.js UI and disposable CI database candidate. This is NOT commercial release acceptance.

| ID | Roadmap scope | Implemented in this engineering batch | Remaining (formally OPEN) |
| --- | --- | --- | --- |
| P4.21 | Preview/download/restore/delete; GET /files/:id/download and POST /files/:id/delete; file_links/versions; access revoked after permission loss | Fresh synthetic record-owner/tenant decision, scanned-file rule, denial of download URLs and deletion writes, fictional lifecycle UI; file_links CI candidate | Real authenticated endpoints, private object storage, download/restore/delete lifecycle and audit; integrate P8 documents |
| P4.22 | Notification inbox, preferences; GET/PATCH /notifications; recipient-only visibility, P7 worker | Strict same-org recipient inbox model, allowlisted deep links and local-only read/preferences preview; CI RLS for notifications/preferences | Real authenticated routes, durable writes, P7 queue/worker, recipient acceptance |
| P4.23 | Separate /platform/* API, admin shell, platform_admin_grants; tenant owners excluded | Independent synthetic server-resolved platform principal with fresh MFA requirement; all platform mutations denied; isolated CI grant table without tenant role grants | Real platform identity enrollment, isolated admin APIs and monitoring, complete auditing |
| P4.24 | Customer-approved time-limited /platform/support-sessions | Explicit active consent/owner/support binding; limited metadata read simulation, expiry and negative tests; CI grant table without tenant role grants | Real approval/revoke UI/API, enforce expiry across services, customer support operations audit |
| P4.25 | Organization closure wizard/export; POST /organizations/:id/closure; deletion_jobs/export_jobs, retention | Owner plus step-up, dependency blocker evaluation, no-op closure/export preview; CI draft-only job metadata | Real durable jobs, legal holds, backup/recovery, billing/files/module reconciliation and deletion/export audit |

## Code and technical evidence
- Backend modules: p4-file-lifecycle.ts, p4-notifications.ts, p4-platform-administration.ts, p4-support-access.ts, p4-organization-closure.ts, and p4-operations-guards.ts.
- Backend unit/negative tests: backend/test/p4-operations-batch05.test.ts.
- Frontend view: /app/organization/continuity (fictional data, no live API).
- Frontend unit tests: frontend/test/p4-operations-preview.test.ts.
- PostgreSQL: 008_p4_synthetic_continuity.sql and its test; the CI workflow runs them only against a disposable database named zoho_clone_synthetic_ci.
- Existing P4.20 storage provider continues to DENY all signed file URLs.
- Verified: [GitHub Actions #44724748196](https://github.com/owaisprog/Zoho-Clone/actions/runs/44724748196), 4/4 CI jobs PASS; 204/204 tests PASS (58 frontend, 133 backend, 5 shared, 8 scripts), including disposable PostgreSQL restricted-role RLS for P4.21–P4.25. Formal acceptance still OPEN in [issue #60](https://github.com/owaisprog/Zoho-Clone/issues/60).

## Security and release restrictions
- No production endpoints, email delivery, customer data, object storage, privileged requests, file download, support session, deletion or export execution enabled.
- The runtime has SELECT-only access to narrowly scoped metadata. It receives no SELECT privilege on platform or support grant tables and no rights to execute jobs.
- Tenant owner membership does not imply platform admin permissions.
- A customer support preview expires; it confers no record or document access.
- All actual real-world workflows (Auth0 issuer/subject, MFA, Prisma runtime RLS and storage provider) require design approvals, staging integration and negative tests.
- Keep P2.02, P3 staging gates and all P4 formal acceptance open. Preserve the original 14 risks, 12 unresolved decisions and 727 original P1.09 not-run cases.
- Do not merge P3/P4 development PRs into main, apply SQL candidates 004–008 to Neon, or authorize external/production use.

## P4 exit checklist
The master roadmap requires TWO isolated demo companies with complete identity, teams, access, files and audit flows, no critical tenant/security defect, real test logs and owner signoff. Batch 05 alone does not satisfy this milestone. The remaining work includes the real Auth0-to-tenant mapping, approved server-side authorization and RLS, private file lifecycle, P7 notification workers, platform/support isolation, audited closure/export and acceptance across the 25 P4 subphases.

Next development action: consolidate P4 acceptance blockers and produce a prioritized integration/closure plan before proceeding to commercially scoped P5 CRM work.

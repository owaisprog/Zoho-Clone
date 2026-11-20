# P4.16–P4.20 engineering batch — preferences, apps, navigation, audit, uploads

**Status:** Synthetic development source and disposable-CI candidate only;
**not** commercially ready, **not** real Auth0/Prisma tenant deployment.
Dated 2026-11-20. Official source: Zoho Clone Express.js master roadmap,
pages 35–37. Implementation lives on
[draft P4 PR #55](https://github.com/owaisprog/Zoho-Clone/pull/55),
based on the still-unmerged P3 development branch in PR #53.

| ID | Implemented | Still blocked |
| --- | --- | --- |
| **P4.16 Organization preferences** | `p4-organization-preferences.ts` validates fictional name, locale, IANA timezone and currency, checks owner on update, uses org-scoped optimistic revision and applies user timezone over org fallback; unit tests include foreign-org and forged data. `/app/organization/platform` has browser-only settings selectors. | Real `GET/PATCH /org/settings`, DB write role, audit integration, reporting/billing policy, owner approval |
| **P4.17 Application registry** | Fixed app manifest; app enabled only if separately entitled AND permitted, with deny/locked status and direct-route tests in an isolated synthetic Express app. Disposable CI `applications` and `app_grants` tables scoped to org. | Authenticated `GET /apps` / `org/apps`, P6 billing/entitlement service and real route middleware, direct URL denial on actual production API |
| **P4.18 Workspace navigation shell** | `/app/apps` launcher with case-insensitive filtering, keyboard Cmd/Ctrl+K and Escape, focusable search, explicit locked cards, links in existing responsive workspace sidebar and settings. | Server-owned `/navigation/manifest`, real permission-aware navigation, keyboard/e2e screen reader acceptance, approved P2 branding |
| **P4.19 Audit log engine** | `p4-audit-log.ts` fixed-action redacted event contract, append-only repository seam and owner-only read check. CI-only `audit_logs` with FORCE RLS, separate INSERT-only non-superuser writer role, no update/delete grants; owner-view vs cross-tenant audit tests. Fictional filterable read-only audit list. | Authenticated `GET /audit-logs`, actual writes wired to **all** mutations, durable independent writer transaction/outbox, legal retention and audit review; no claim of tamper-proofness against DB owners |
| **P4.20 File upload service** | `p4-file-upload.ts` validates metadata, claimed server-verified same-org/record ownership, safe MIME/size/hash, denies foreign file requests and **always** refuses signed upload/download URLs; CI-only `files/file_versions` metadata with quarantine/scan fields and forced RLS. Disabled file picker/empty attachment list in preview. | Real `POST /files/uploads` / `GET /files/:id`, provider selection, private bucket, direct-to-quarantine upload, malware scanning, real record permissions, signed URL TTL, audit and retention; **no uploads may run** |

## PostgreSQL and deployment safety

`backend/db/candidates/007_p4_synthetic_settings_apps_audit_files.sql`
and `backend/db/tests/007_p4_synthetic_settings_apps_audit_files.sql`
run **only** in ephemeral CI database `zoho_clone_synthetic_ci`,
after candidates 004–006. They use `SET ROLE p4_synthetic_ci_runtime`
(non-owner/non-BYPASSRLS) for tenant isolation and a different
`p4_synthetic_ci_audit_writer` role for INSERT-only audit events.
The schema enforces default-deny for settings/grants/audit/file records,
organization-scoped SELECT, no arbitrary runtime writes, append-only
audit behavior and foreign-file metadata denial.

**Never apply candidates 004–007 to the owner's Neon
`zoho_clone_synthetic` database.** Do not alter `p3_neon_reader` or
commit actual customer file names, identity tokens, storage keys, payment
credentials, invoice data or audit before/after secrets.

## Formal exit requirements (still OPEN)

1. Reconcile OPEN-001/002/003, P1.06 permissions matrix and P2.02
   information architecture, and secure explicit owner approval.
2. Validate actual verified Auth0 `(issuer,sub)` -> internal user mapping,
   active tenant membership, application entitlements and P4.13 RBAC/ABAC
   in direct API and browser routes under real staging.
3. Run RLS with the **actual production/staging** runtime role and Prisma,
   not merely a local CI synthetic role.
4. Approve managed secret vault, Auth0 MFA/revocation, region/budget,
   staging deployment/rollback and GitHub required checks.
5. Implement auditable atomic write paths, retention, rotation,
   tamper-evidence and independent review; approve audit-reader roles.
6. Approve a private object-storage provider, upload quarantine and
   malware scanner, short-lived signed grants, scan result provenance,
   record ownership, file versions, download/delete behavior and
   cross-tenant probes. **Current file provider denies all uploads.**
7. Run relevant original P1.09 acceptance/security cases with two
   isolated fictional organizations and obtain a formal owner P4 signoff.

Original 14 open risks, 12 unresolved decisions and 727 unexecuted
P1.09 acceptance cases remain OPEN. Commercial/external release
gates G-EXT and G-COM remain BLOCKED. No main merge or production
deployment approved by these synthetic tests.

## Deferred Mac handoff

No Mac changes are needed for this GitHub batch. When ready to switch
to the feature branch *after preserving local changes*, run
`npm ci`, `npm run typecheck`, `npm run test`, `npm run build`.
Demo pages: `/app/apps` and `/app/organization/platform`.

## Verified CI evidence (2026-11-20)

[GitHub Actions #44719617968](https://github.com/owaisprog/Zoho-Clone/actions/runs/44719617968)
completed **4/4 jobs PASS**: **55 frontend + 125 backend +
5 shared + 8 Node script tests = 193 PASS, 0 FAIL**.
TypeScript, Next.js and Express builds, Prisma schema validation,
disposable Postgres/Redis boot, limited tracked-secret scan, and
CI-only RLS tests succeeded. The SQL log includes:
`P4.16-20 CI-only preference, app, audit and private file RLS PASS`.

The restricted PostgreSQL role denied unapproved writes and cross-org
file/settings access. A separate audit-writer role could INSERT a
redacted audit row but could neither UPDATE nor DELETE one.

This is synthetic CI evidence, NOT 727 original P1.09 product cases,
actual Auth0-to-user integration or production-grade private storage.
Remaining acceptance is tracked in
[issue #59](https://github.com/owaisprog/Zoho-Clone/issues/59).

# P4 exit integration-hardening — batch 02

**Roadmap basis:** Owner's *Zoho Clone AI Master Roadmap — ExpressJS FINAL*, P4.11, P4.13, P4.17–P4.22 and Phase P4 exit milestone (PDF pages 34–39). P5 requires P4 tenancy, permissions, shell and file service (page 40).

**Status:** Engineering checkpoint verified in disposable CI. **Not formal P4 exit acceptance or a release approval.**

## Five implementation slices

| Slice | Implemented in actual source | Formal acceptance still open |
| --- | --- | --- |
| 1. Fresh authorization | `p4-platform-read-model.ts` verifies restricted non-owner PostgreSQL runtime role, current actor's active membership, exact membership role, role assignment and immutable permission catalog **inside** a tenant-local transaction | Real Auth0 identity and managed staging connection with approved final permissions, row/field rules and production DB role |
| 2. Application entitlement and direct routes | Server queries org-specific app grants and role permissions; available apps require BOTH entitlements and permissions; `/:orgId/apps/:code` rejects a locked direct URL | P6 billing entitlement service and authorized production API |
| 3. Server-generated workspace navigation | Navigation is derived from the allowed app manifest, not browser choices; locked apps don't appear as accessible links | Authenticated Next.js navigation and browser/a11y integration acceptance |
| 4. Recipient-only notifications and private file metadata | `/:orgId/shell` exposes restricted fictional notification categories and allowlisted paths, file metadata with `downloadEnabled=false`; no storage keys or signed download URLs | P7 notification workers/email, real file provider, scan/quarantine, record/field permissions, secure file download and delete |
| 5. Owner-only redacted audit | `/:orgId/audit-logs` reads redacted append-only audit events only under current owner role+RLS; foreign/revoked actors denied | Durable audit integration for **every mutation**, retention, independent security review and owner-approved audit roles |

## Source changes
- `backend/src/platform/p4-platform-read-model.ts`
- `backend/src/platform/p4-integration-test-router.ts` (read-only test routes)
- `backend/src/scripts/p4-ci-live-read.ts` (actual disposable pg client, two orgs)
- `backend/test/p4-platform-read-model.test.ts`

No real organization writes, unrestricted public Express route, storage signed URLs, uploads/downloads, customer notifications, production credentials, or deletion/export jobs were enabled.

## Test evidence
[GitHub Actions #44729808943](https://github.com/owaisprog/Zoho-Clone/actions/runs/44729808943) completed **4/4 jobs PASS**:
- Frontend 58 tests
- Backend 147 tests
- Shared 5 tests
- Node script safety 8 tests
- **Total 218 passing, 0 failing**.
- Real disposable PostgreSQL restricted role and forced-RLS checks passed for two orgs. Console confirms `P4 exit integration 02: real restricted PG entitlements, nav, notices, redacted audit and file metadata PASS`.
- Test-only HTTP checks deny forged client headers, locked apps, cross-tenant routes, unapproved writes, file download endpoints and tampered model data.

## Limitations / next owner gates
- Client-side preview pages are still fictional; this batch does **not** provide a real production dashboard.
- Auth0 JWKS SDK composition is implemented only on a development-only router; live credentials, MFA, identity provisioning and revocation have not been exercised.
- Schema `p4_synthetic` exists only in disposable GitHub CI; SQL candidates 004–009 must **never** be applied to the owner's Neon database.
- This API uses the exact ephemeral CI role `p4_synthetic_ci_runtime`, not the actual staging/production database role.
- Complete P3 staging/secret/rollback controls and P2.02 information architecture approval; keep original 14 risks, 12 decisions and 727 unexecuted P1.09 cases open.
- Keep [P4 exit issue #61](https://github.com/owaisprog/Zoho-Clone/issues/61) open until full real-world verification with two isolated test organizations, file flows, audits and owner signoff.

**Next suggested work:** Establish owner-approved managed staging/auth/storage configuration and wire the actual database/runtime policy end-to-end, or continue implementing isolated synthetic adapters only where external signoff is unavailable. P5 production start requires P4 security approval.

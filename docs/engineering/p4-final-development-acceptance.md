# P4 final development and acceptance increment
PR #158 exact head 6f8733492e1441c46008015beb8b52ccb2c7e35e, CI 45910201662, all four jobs passed. Logs confirmed P4_STAGE_APP_ACCESS_PASS and P4_PERMISSION_WORKSPACE_PASS. This increment is based on that verified head.

## Five remaining subphases
11. Integrated security: current platform entitlement enforced for administrative sales/team grant reads and writes, not just CRM reads. Test suspension, cross-tenant and owner-without-sales denial.
12. Audit: restricted owner-only sanitized grant event page; immutable ledger, bounded cursor, actor/action/time, replay and member/foreign denial. No audit of all denied attempts, general production audit endpoint or SECURITY_REVIEWER role is implemented.
13. Recovery: actual pg_dump/pg_restore of ten tables, forced RLS and row digest reconciliation, post-backup role/team/membership/entitlement revocations and their grant audit delta. Restore in a separate disposable database, never served to users; app reads/writer remain denied there. Reconciliation is an explicit known-fixture exercise, not general disaster recovery or live backup authorization.
14. Selected original case scenarios: executable assertions for seven inventory IDs, six narrow engineering scenarios and one partial read denial. Exact markers must be confirmed from CI logs. Original formal test status is unchanged. No claim to have executed the full original case contracts or accepted them.
15. Release gap: validate original baseline, case links and open gates in a separate manifest. Final P4 engineering increment may be considered implemented only after its own exact-head CI passes. Do not mark P4 formally complete or P5 release approved.

## Remaining release blockers
- Real isolated staging Auth0 signed session, MFA, CSRF/logout and revocation; review dedicated restricted staging migration/writer and tenant database topology; no existing Neon modification.
- Actual organization bootstrap, invitation and owner-transfer integration into the same UUID schema remains incomplete; older CI candidates are not a unified production implementation. Live Next.js permission workspace and real staging writer are not mounted.
- Full app/resource/action policy, persistent file metadata and private scanning/provider lifecycle, durable notification outbox and recovery in same schema remain unintegrated; retain all prior candidate implementations and tests.
- Formal acceptance inventory 727, executed 0; 108 P4-linked cases in original R90 review (43 partial references, 65 unmapped); this separate seven-case increment does not rewrite those historical counts. 10 gates, 14 risks, 12 decisions remain open. Original P2/P3 signoff, operations, risk/decision dispositions and owner exit approval required.
- P5 synthetic engineering may be proposed after final CI verification, but no production access, release, merge, deployment, real Auth0/Neon changes or paid resources are approved. Budget $0 additional monthly. Sentry remains disabled, hosted Blob/Queues prospective only.

Run: existing synthetic-postgres-isolation job, after integrated browser test. Requires fixed disposable CI environment and verified PostgreSQL container. Read-only audit scope and write policy are CI-only. Evidence link validator checks inventory and script markers, not whether they ran; inspect exact run logs for actual execution. No new dependencies or workflows.

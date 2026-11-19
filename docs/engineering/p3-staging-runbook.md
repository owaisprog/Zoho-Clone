# Master P3.10 — Staging deployment, smoke and rollback runbook

**Status:** scripts and verification contract prepared. **No cloud staging
deployment has been performed or verified**; owner credentials, budget,
provider and allowed region are still pending.

## Local synthetic-only preflight

Run on Node 22+ with no real data:

```bash
npm ci
npm run typecheck
npm test
npm run build
bash scripts/verify-synthetic-preview.sh
docker compose -f docker-compose.yml config
docker compose up -d --wait postgres redis
# When done with disposable services:
docker compose down
```

The local smoke MUST return 200 from `/health/live` and 503 from
`/health/ready` (unconfigured). This confirms unapproved dependencies
**fail closed**; it is not a staging release.

The container stack maps PostgreSQL to 127.0.0.1:5433 and Redis to
127.0.0.1:6380. Postgres initialization executes the synthetic SQL and
fictional seed ONLY on a fresh named volume. To reset, explicitly
`docker compose down -v` (destroys local demo data).

## Future staging deployment (owner account required)

1. Owner selects API hosting, staging URL/domain, credentials, DNS,
   region, managed PostgreSQL, managed auth, and monthly cost cap.
2. Provision a distinct GitHub environment named `staging` with
   branch restrictions and required reviewer. No production secrets.
3. Provision minimal non-owner DB role + reviewed migrations + backups.
4. Pin artifact/commit digest, run CI, perform schema expand migration
   after backup, deploy backend API in isolated network and web preview.
5. Configure a REAL readiness probe for database and identity provider,
   test `/health/live` 200 and `/health/ready` 200 only when healthy.
6. Set `STAGING_API_URL` to owner-approved HTTPS staging API base and run
   `bash scripts/verify-staging-health.sh`.
7. Exercise synthetic tenant separation, permissions, browser flows,
   response headers, failed-identity and DB-outage cases.
8. Record artifact hashes, CI run URL, deploy ID, health and rollback logs.

## Rollback

If readiness, data-isolation or security fails, stop public exposure
and restore the prior known-good backend/web artifact by digest.
Do **not** roll back an applied destructive database migration without
explicit backup and compatibility review. Verify schema compatibility
and run health/tenant tests again, record incident and owner approval.

## Release gates

A green local CI build is NOT verified staging, provider approval,
tenant isolation, accessibility certification or commercial launch.
Keep original 727 cases and 14 risks/12 decisions tracked as open
until their proper acceptance evidence exists.

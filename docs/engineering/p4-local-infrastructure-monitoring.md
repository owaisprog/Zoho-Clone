# P4 zero-cost local infrastructure and monitoring handoff

PR #151 exact head 76b6218b3d74dc651e4b58a420b7d4eadc106b60 passed all four checks in run 45853438976. Actual SeaweedFS authenticated S3, anonymous and bad-signature denial, clean release and infected quarantine passed. Existing BullMQ and ClamAV checks also passed.

## Local infrastructure

- GitHub: stacked draft PRs, CI checks and main protection retained.
- Existing Neon database zoho_clone_synthetic and Auth0 development settings: unchanged. They are not approved staging identities or database permissions.
- Vercel: empty zoho-clone-web and zoho-clone-api project shells, no linked repo or deployed code. Hobby use must remain within Vercel plan terms; no commercial deployment authorization.
- Redis: local Docker loopback 6380; no Upstash.
- BullMQ: bounded local synthetic worker command; no real durable outbox processing.
- ClamAV: network-disabled local scanner with fictional EICAR verification; image provenance/signature updates remain gated.
- SeaweedFS: disposable authenticated local S3 test, internal network + restricted loopback relay; no customer storage.
- Monitoring: existing bounded local request metrics plus one-shot Express health monitor; optional narrow Sentry envelope integration.

## Local run sequence

Use the reviewed branch and Node 22, with no production credentials and a local Docker context. Do not run migrations or connect a new database.

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm run test
npm run build
docker compose up -d redis
docker compose exec -T redis redis-cli PING
P4_LOCAL_WORKER_ENABLED=true P4_LOCAL_REDIS_URL=redis://127.0.0.1:6380 npm run worker:local -w backend
docker compose -f docker-compose.local-files.yml pull scanner
P4_LOCAL_FILES_ENABLED=true ./node_modules/.bin/tsx scripts/p4-local-files-smoke.ts
P4_LOCAL_FILES_ENABLED=true P4_LOCAL_SEAWEED_ENABLED=true ./node_modules/.bin/tsx scripts/p4-local-seaweedfs-smoke.ts
P3_SMOKE_PORT=4000 P4_LOCAL_MONITOR_ENABLED=true P4_LOCAL_SENTRY_SEND=false bash scripts/verify-synthetic-preview.sh
```

Alternatively with local API already running on port 4000, use P4_LOCAL_MONITOR_ENABLED=true npm run monitor:local -w backend. Healthy means liveness 200 and intentionally denied readiness 503, never production-ready. CI runs the real health probe with Sentry explicitly disabled, and unit tests use fictional DSN and injected transport. No SDK auto-instrumentation, browser replay, profiling, stack capture, request payload or source upload.

## Sentry account and separate activation

Sentry Developer plan advertises $0, one user and 5,000 errors (https://sentry.io/pricing/). Account creation, plan/quota confirmation, DSN entry and live provider delivery are not performed by this PR. No paid trial, billing method or paid add-on should be enabled. Owner must create a separate synthetic project and confirm the free plan, then separately approve exactly one fictional test event. Enter values privately into local shell environment, never commit or paste credentials into chat.

Required env names for optional one-shot send:
P4_LOCAL_MONITOR_ENABLED=true
P4_LOCAL_SENTRY_SEND=true
P4_LOCAL_SENTRY_OWNER_APPROVAL=approved
P4_LOCAL_SENTRY_PLAN=developer-free
P4_LOCAL_SENTRY_DSN (separate synthetic project DSN)
P4_LOCAL_SENTRY_HOST (exact DSN ingest hostname)
P4_LOCAL_SENTRY_PROJECT (exact numeric project ID)

Then run npm run monitor:local -w backend -- --send-test only after explicit owner approval. One send attempt per process; no automatic retry; no scheduled or live runtime exporter. The plan field is an owner assertion, not a billing API verification or global quota cap. A 2xx indicates ingestion accepted the request, not confirmed dashboard visibility. Sentry SaaS receives network metadata; no application identities or secrets are included in the fixed event. Cloud transfer is forbidden in CI/Vercel/production or without approval. This is a narrow dependency-free Sentry envelope transport, not full official SDK monitoring. A production SDK, PII controls, retention, quota configuration, alert routing and actual dashboard evidence remain open.

## Release checkpoint

Local infrastructure code preparation can be exercised with synthetic data; actual owner laptop setup and account activation are not verified. No charges authorized; all 10 P4 gates remain open, all original risks, decisions and formal acceptance cases remain unchanged. No merge, deployment or live migration. Staging approval, identity and permission integration, durable worker/outbox, tenant file ACL and metadata, recovery and formal acceptance remain outstanding. P4 NO_GO.

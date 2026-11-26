# P4 local BullMQ worker — zero additional hosting cost

Owner selected existing Neon and Auth0 development configuration, unlinked Vercel project shells, local Docker Redis instead of Upstash. The existing cloud staging configuration guard remains unchanged. This local increment is deliberately synthetic-only and does not activate any staging membership, production queue or external provider.

From the repository root, using the reviewed branch, Node 22 and Docker:

```sh
npm ci --no-audit --no-fund
docker compose up -d redis
docker compose exec -T redis redis-cli PING
P4_LOCAL_WORKER_ENABLED=true P4_LOCAL_REDIS_URL=redis://127.0.0.1:6380 npm run worker:local -w backend
```

The command runs an actual BullMQ producer and separate Worker object against local Redis, processes one fixed fictional report, verifies duplicate job IDs produce one completed job, then closes the worker and removes only its random per-run queue. It never starts or modifies Postgres, Neon or Auth0. It does not expose an HTTP route. It rejects non-loopback Redis, production/Vercel environments and staging activation. A bounded process watchdog and finite retries avoid indefinite hangs. Redis is intentionally disposable under the existing Compose configuration; no persistence guarantee.

The existing production source and compiled import guards forbid the p4-ci-local-worker modules. Tests exercise invalid payloads, unexpected jobs and unsafe configurations. Compose CI executes the real Redis run, without modifying any existing acceptance assertions.

Remaining: separate long-lived worker for a reviewed durable application outbox, tenant authorization at execution, restricted writer, recovery, retry/idempotency across restarts, operations and staging verification. The fixed synthetic report is not a CRM reporting feature. All 10 release gates remain open, P4 formal exit remains NO_GO, and all original risk, decision and acceptance records are unchanged. No paid service, merge, deployment or live migration.

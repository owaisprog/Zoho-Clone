# P4 local SeaweedFS integration (synthetic only)

Owner approved SeaweedFS as the free local S3-compatible replacement for MinIO. PR #150 exact head 3931c3a098d9bdef1700c97afadb8aa0ddd29b52 passed all four checks, including real ClamAV clean release, EICAR quarantine and failure denial.

This increment pins the community release 4.55 (November 23, 2026) and uses the upstream documented mini mode, with two pre-created buckets and random per-run S3 credentials. Only the S3 port is mapped to 127.0.0.1:18334; internal/admin ports are not mapped, and the service uses its own internal Docker network. No external access, tunnel, paid service, Neon, Auth0 or Vercel changes.

From the repository root with Node 22 and a local Unix-socket Docker context:
```sh
npm ci --no-audit --no-fund
docker compose -f docker-compose.local-files.yml pull scanner
P4_LOCAL_FILES_ENABLED=true P4_LOCAL_SEAWEED_ENABLED=true node_modules/.bin/tsx scripts/p4-local-seaweedfs-smoke.ts
```

The smoke starts a randomly named disposable project with fresh credentials, checks signed and unsigned access, uses the same quarantine policy and real ClamAV scanner, and deletes only its own object keys and isolated volume. No credentials are printed or committed. The adapter is a deliberately narrow native SigV4 wire test (not a general-purpose or production signing library), with fixed loopback endpoint, two fixed bucket names, canonical UUID object keys, exact payload bounds, request timeouts and redirect denial. No ambient AWS credential lookup. The local filesystem adapter remains available; both implement the same fail-closed scanner/release policy.

References: https://github.com/seaweedfs/seaweedfs/releases/tag/4.55 ; https://github.com/seaweedfs/seaweedfs/wiki/Quick-Start-with-weed-mini ; https://github.com/seaweedfs/seaweedfs/security . Internal service isolation is important given upstream administrative RPC advisories. The pinned version tag is not an immutable verified image digest, and neither the local fixture credentials nor the admin-capable mini bootstrap identity are suitable for production. Production must use a reviewed official S3 SDK, distinct least-privilege scanner/writer identities, TLS, authenticated private network, signature update policy, persistent DB-backed metadata, tenant ACL, retention, audit, backup/recovery and verified image provenance. All remain gated; no real application route, customer file ingestion, stage activation, merge or deployment.

CI adds the real SeaweedFS/ClamAV smoke to the existing Compose job without removing prior tests. All ten P4 release gates stay open, and this work does not count as formal acceptance execution.

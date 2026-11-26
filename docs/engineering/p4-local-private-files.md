# P4 local private files and ClamAV — synthetic only

PR #149 exact head e8766da98a1f370637873a79f1f46d5a76e56c89 passed all four CI checks, including the real Docker Redis smoke. This increment uses a private disposable filesystem adapter and ClamAV; no live file provider is activated.

## Provider decision

MinIO Community Edition's upstream repository was archived April 25, 2026; upstream stopped providing precompiled community releases and historical images are not an acceptable maintained security baseline. See https://github.com/minio/minio and https://github.com/minio/minio/releases. Do not silently install an outdated or unofficial MinIO image. A maintained S3-compatible local provider (e.g., SeaweedFS) requires owner selection and dependency/security review. Until then, the private filesystem implementation is an explicitly temporary local synthetic adapter, not an S3 provider or production file store.

## Local run

From the reviewed repository root, Node 22 and Docker:
```sh
npm ci --no-audit --no-fund
docker compose -f docker-compose.local-files.yml pull scanner
P4_LOCAL_FILES_ENABLED=true ./node_modules/.bin/tsx scripts/p4-local-files-smoke.ts
```

ClamAV uses the official 1.4 release-line image with bundled signatures. The scanner runs with no network or published port, no host file mounts, dropped capabilities, read-only root, and a bounded temporary filesystem. The smoke submits only fictional bytes through stdin, checks an exact verdict and uses the harmless standard EICAR marker. The image tag can change; production image digest and signature age, update policy and vulnerability review remain open. The command must fail rather than release an object when scanning or image startup fails.

The local private file adapter creates an isolated temporary directory with quarantine and clean subdirectories, restrictive modes, server-generated object IDs and a 4096-byte limit. It never uses client paths. Scanned bytes are snapshotted and digest-checked; only exact clean verdict can release a snapshot. Infection, scanner error, conflicting verdict or digest failure cannot release. No HTTP routes, CRM permissions, Neon, Auth0, public bucket, external upload, signed URL or production readiness are introduced. Temporary data are removed at normal teardown, and abnormal process recovery remains unverified.

CI adds a real ClamAV smoke and unit tests; existing assertions remain intact. All 10 P4 gates, 14 risks, 12 decisions and 727 formal cases remain open/unexecuted as previously recorded. Zero additional service charges authorized. No merge or deployment.

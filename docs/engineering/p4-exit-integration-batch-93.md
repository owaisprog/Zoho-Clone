# P4 Batch 93 — isolated staging preparation

Owner authorized preparation only on 2026-11-26. All release gates remain OPEN. No paid resources, deployment, main merge or live Neon modification.

Five slices: (1) scope lock; (2) eight-service topology inventory; (3) private ingress, identity and database separation; (4) rollback and artifact controls; (5) executable fail-closed manifest validation with negative tests.

Proposed topology: private web/API ingress, independently scoped worker, isolated Postgres and Redis, separate identity tenant, private object storage and scanner. Hosting provider, region and monthly cost cap remain unset pending owner selection. No external endpoints or credentials are accepted by this preparation utility. The SHA-256 digest identifies the preparation manifest only; it does not attest a built artifact or deployment.

Run `node scripts/p4-r93-staging-preparation.mjs` and `node --test scripts/p4-r93-staging-preparation.test.mjs`. Existing CI executes scripts/*.test.mjs. This is an offline preflight, not a deployed staging environment. R10-C1–C5 remain unapproved. P4 formal exit remains NO_GO.

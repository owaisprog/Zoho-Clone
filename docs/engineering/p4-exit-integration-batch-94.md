# P4 Batch 94 — database migration review preparation

Five slices: ordered UUID foundation inventory; offline SHA-256 fingerprinting; disposable-only guard checks; least privilege and tenant migration prerequisites; negative tests and explicit no-execution result.

The six existing candidates 058–063 cover identity/tenant foundation, platform permissions, private files, notifications, queue and grant epochs. They are CI-only and contain bootstrap assumptions; do not copy them into a production migration directory or run them against Neon. The existing legacy CRM schemas are separate; mapping and reconciliation are still required. No production DDL has been approved or generated. The R91 restore evidence is disposable only.

Before a staging migration: review new DDL and all RLS/function grants independently; approve a separate staging database and restricted login roles; reconcile legacy CRM models; approve backup and restore procedures; obtain explicit migration authorization. R10-C1–C5 remain pending; no writer grants are enabled.

Run `node scripts/p4-r94-migration-review.mjs` and `node --test scripts/p4-r94-migration-review.test.mjs`. This reads repository files only, not database credentials or connections. Candidate hashes are review references, not signatures or migration authorization. Existing CI runs scripts/*.test.mjs. All release gates remain OPEN.

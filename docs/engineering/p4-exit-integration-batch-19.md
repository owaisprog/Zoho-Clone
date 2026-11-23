# P4 Batch 19 — production application boundary enforcement

Date: 2026-11-23. Stacked on verified Batch 18. **Synthetic-only, draft PR**. No deployment, live identity, Neon migration or real users.

## Five implemented tasks
1. Strengthen the P4 source-graph guard to fail closed for **all** CI-specific platform modules (not only HTTP routers), transitive imports, direct imports, unresolved relative paths, traversal, backend aliases, nonliteral dynamic imports/require and suspicious canonical path resolution.
2. Add nine source-graph negative unit cases for CI Prisma and identity helpers, unresolved files, computed imports/require, aliases, traversal, canonical escapes and static require.
3. Build an **independent post-compile** Express entrypoint graph check over actual `backend/dist/app.js` and `backend/dist/server.js` with seven negative/safe tests, ensuring test-only IAM modules cannot be reachable from a normal compiled backend.
4. Add four end-to-end normal Express app tests (actual `createApp` and Supertest): private CI IAM routes stay 404 for all HTTP verbs, forged authorization headers or query parameters reveal no IAM data, normal synthetic liveness continues to work.
5. Require post-compile scan in the standard GitHub Actions verify job **after** build; both source and compiled scanner tests run in `scripts/*.test.mjs`, and the normal workspace backend tests run in `npm run test`.

## Security and release boundaries
These checks catch accidental shipping and routing of synthetic CI helpers. They are not formal pentesting, secure credential delivery, KMS/rotation, or a production migration. The repository still contains deliberately synthetic-only candidate database readers that require separate privilege design and independent review.

P4 formal exit #61, R10-C1–C5 write approvals, original 14 risks, 12 unresolved decisions, 727 originally unexecuted P1.09 cases, real Auth0 and MFA, private storage/scanning/retention, P2.02, staging and P3 owner acceptance stay OPEN. No customer data, production connection, real Auth0 token, cloud purchase, main merge or deployment.

CI verification pending when authored. Record final run ID and numbers in PR only after verified success.

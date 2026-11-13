# Backend — actual P3.01 Express 5 + TypeScript scaffold

**Implemented source:** Express 5 server, localhost-only configuration, safe JSON
errors, Helmet security headers, and \`GET /api/v1/health\` process-only health endpoint.

**NOT implemented:** PostgreSQL/Prisma schema, authentication/OIDC, tenant/RBAC/ABAC,
CRM/merchant CRUD, event workers, processors, KYC, payments, real billing or production
deployment. Do not send real data to this scaffold.

Run from repository root:

~~~sh
npm install
npm run dev:api
~~~

Check http://127.0.0.1:4000/api/v1/health . To run tests:

~~~sh
npm run test -w backend
npm run typecheck -w backend
npm run build -w backend
~~~

The health endpoint establishes **process health only**, not database readiness,
security compliance or a working customer platform. CI/local execution evidence
must be recorded separately, and unexecuted tests must not be called passing.
Default bind is 127.0.0.1; it is not internet-exposed.

## P3 batch 01: fictional GET endpoints only

The API additionally exposes `GET /api/v1/demo/leads` and
`GET /api/v1/demo/applications` from fixed, invented demo arrays. They include
a versioned synthetic contract and are checked against shared allowlisted
fixtures. No POST/PATCH/DELETE endpoints exist. The API binds locally only;
do not use it for real merchant, client, employee, financial or identity data.

See [batch notes](../docs/engineering/p3-batch-01.md).


## P3 Batch 02 — fictional task API

\`GET /api/v1/demo/tasks\` returns a few hardcoded \`TASK-DEMO-*\` examples with the same
shared fictional-only contract and no-store headers as the lead/merchant demos.
No server-side task mutation or real-user activity is implemented. The endpoint
remains local-only; no real names, work records, processor information or credentials.

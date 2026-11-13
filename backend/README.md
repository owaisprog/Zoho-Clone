# Backend — actual P3.01 Express + TypeScript scaffold

**Implemented source:** Express 5 server, localhost-only configuration, safe JSON errors,
Helmet security headers, and \`GET /api/v1/health\` process-only health endpoint.

**NOT implemented:** PostgreSQL/Prisma schema, authentication/OIDC, tenant/RBAC/ABAC,
CRM/merchant CRUD, event workers, processors, KYC, payments, real billing or production deployment.
Do not send real data to this scaffold.

Run from repository root:
\`\`\`sh
npm install
npm run dev:api
\`\`\`

Check \`http://127.0.0.1:4000/api/v1/health\`. To run tests:
\`\`\`sh
npm run test -w backend
npm run typecheck -w backend
npm run build -w backend
\`\`\`

The health endpoint only establishes **process health**, not database readiness or security
compliance. CI/local execution evidence must be recorded separately; unexecuted tests must
not be called passing. Default bind is 127.0.0.1 (not internet-exposed).

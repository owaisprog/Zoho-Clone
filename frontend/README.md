# Frontend — actual Next.js 16 + TypeScript P3.01 scaffold

**Code now exists** under [src/app](src/app), [src/components](src/components),
[src/lib](src/lib), and [src/styles](src/styles).

## Run locally (Node.js 22+)

From the **repository root**:

~~~sh
npm install
npm run dev:web
~~~

Open http://localhost:3000 for the synthetic concept landing page and
http://localhost:3000/app for the dashboard.

To see API process status as "running", also launch the API in another terminal:

~~~sh
npm run dev:api
~~~

To test source:

~~~sh
npm run test -w frontend
npm run typecheck -w frontend
npm run build -w frontend
~~~

## Actual P3.01 routes

- \`/\`: original public-facing concept landing page — **not a published offer**.
- \`/app\`: fictional workspace dashboard with server-to-server API process health display.
- \`/app/sales/leads\`: read-only fictional leads with local search.
- \`/app/operations/applications\`: read-only fictional internal merchant queue with local search.
- \`/app/settings\`: read-only description of planned settings/security features.

Theme toggle works in the browser. CSS primitives correspond to the owner-approved
**provisional** P2.01 token palette. They have NOT been automatically generated from
\`docs/design/design_tokens.json\` and must not be advertised as WCAG-certified.

**There is no login, real membership, tenant authorization, database, create/edit,
processor approval, billing, customer information or production service.** Do not
put real customer/card/bank/identity/KYC data into this demo. P2.02 remains open
and may change future route names; these are only safe early preview routes.

The synthetic fixture labels and example.com addresses are deliberately fictional.

## P3 batch 01: fictional lead workbench

P3.04–P3.07 code adds a shared strict demo API contract, dynamic pipeline snapshot,
local-only health/data checks, a synthetic lead editor and safe loading/error UI.
Browse `/app/sales/leads` to add or edit explicitly fictional leads **in browser
memory only**. Nothing is POSTed, persisted or available to other users. Reload
restores the fixed example.com fixtures. These prototype interactions must not
be misrepresented as working CRM backend CRUD.

See [batch notes](../docs/engineering/p3-batch-01.md). All 14 risk gaps, 12 open
decisions and 727 original tests remain unresolved/unexecuted.

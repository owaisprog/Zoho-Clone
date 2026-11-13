# P3 Batch 02 — Five additional internal engineering subphases (P3.08–P3.12)

**Status: source committed and CI-verified; product-owner acceptance pending.** This is a new, limited synthetic-only implementation sequence following P3.03–P3.07, not release signoff or evidence that unresolved gates are closed.

**Branch:** `feat/p3-batch-02`, stacked on `feat/p3-batch-01` (which remains a draft PR #28, itself stacked on P3.02 draft PR #27). Do not merge out of order or treat source presence as an approved feature.

## Subphase implementation scope

| Subphase | Actual functionality | Deliberate limits |
|---|---|---|
| **P3.08 — Lead detail and session activity** | Select fictional lead details; display example contact, stage, owner, and a generated create/edit activity trail in `lead-workbench.tsx`, `demo-lead-events.ts` | No user-supplied notes, permanent audit trail, actual contact activity or customer information |
| **P3.09 — MerchantOps internal queue preview** | Stage filters, text search, company sort, pagination, reset and restricted single-step internal stage progression in `application-workbench.tsx` | Never provider approval, underwriting, real activation, payment acceptance or a database write |
| **P3.10 — Fictional tasks** | Fixed `GET /api/v1/demo/tasks` Express endpoint, versioned/validated shared contract, Next.js server adapter/fallback, task board at `/app/tasks`, local next-step controls | No persistent task assignments, real task notifications, due dates, agents, jobs or external integrations |
| **P3.11 — Workbench UX** | Shared stable sort and bounded pagination helpers, previous/next controls, accessible filter states, responsive CSS, reset/empty states across leads, applications and tasks | No final P2.02 information architecture approval or audited accessibility |
| **P3.12 — Demo-only safety/regression tests** | Synthetic-contract, immutable fixture, task endpoint rejection, no real IDs/emails, invalid payload fallback, prohibited task API writes, app-stage and event tests | Does NOT execute the original 727 P1 acceptance/security scenarios or claim multi-tenant isolation |

## How to inspect locally

Use **Node.js 22+** from the repository root:

```bash
npm ci
npm run typecheck
npm run test
npm run build
npm run dev:api    # terminal 1 (127.0.0.1:4000)
npm run dev:web    # terminal 2 (localhost:3000)
```

- `http://localhost:3000/app`: fictional overview with task entry point.
- `http://localhost:3000/app/sales/leads`: lead workbench, detail drawer and session-only activity.
- `http://localhost:3000/app/operations/applications`: internal-only operations queue preview.
- `http://localhost:3000/app/tasks`: fictional task checklist.
- `http://127.0.0.1:4000/api/v1/demo/tasks`: read-only demo contract.

**Reminder:** The public demo is unauthenticated and must remain entirely fictitious. New/changed statuses and lead edits exist in client memory and vanish after reload. The Express endpoints only expose checked-in invented examples and have no POST/PUT/PATCH/DELETE. Enter no real customer information.

## Required review gates

- Verify locked npm CI install, frontend/backend/shared TypeScript, tests and builds independently. Do not report passes before the run completes successfully.
- Inspect UI manually for usability/accessibility; CI typechecking does not establish browser coverage.
- Keep **P2.02 #25**, **P3.01 #26**, P3.02 PR #27, and P3.03–P3.07 draft PR #28 open unless the product owner explicitly reviews and accepts them.
- **All 14 documented evidence risks, 12 undecided product decisions, and the original 727 P1.09 future acceptance/security tests remain OPEN/NOT RUN.** All 40 separate P2 IA review cases also remain NOT RUN.
- G-EXT and G-COM external/commercial gates stay **BLOCKED**. No real users, authorization, database, tenant isolation, processor onboarding, KYC, payments or production deployment has been implemented.

The `/app/tasks` menu entry is a provisional internal navigation demonstration and not an owner approval of the P2.02 route inventory.

## Independently verified CI evidence

[Run #43502348085](https://github.com/owaisprog/Zoho-Clone/actions/runs/43502348085) **SUCCESS** at commit `6dd5df224b7462a1c210f69e87acb69545bdf53d`:
- Locked Node 22 `npm ci` installation: PASS.
- Frontend and backend strict TypeScript typechecks: PASS.
- Frontend **34 tests**, backend **13**, shared demo contracts **5** — **52 passed, 0 failed**.
- Next.js production build and Express TypeScript build: PASS.

These are *new isolated scaffold/demo tests* and do not execute any original P1.09 product/security scenarios. No browser UI inspection, authenticated tenant/record/field isolation testing, accessibility certification or deployment was performed. The five phase tracking issues remain open pending owner review: [#35](https://github.com/owaisprog/Zoho-Clone/issues/35), [#36](https://github.com/owaisprog/Zoho-Clone/issues/36), [#37](https://github.com/owaisprog/Zoho-Clone/issues/37), [#38](https://github.com/owaisprog/Zoho-Clone/issues/38), and [#39](https://github.com/owaisprog/Zoho-Clone/issues/39).

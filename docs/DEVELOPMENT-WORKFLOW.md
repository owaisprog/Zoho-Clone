# ChatGPT-led Development Workflow

## Branch and review rules
- `main`: stable/release branch; avoid direct feature commits.
- `develop`: integration branch for planned phase work.
- `feat/PX-description`: work branches for implementation when appropriate.
- PR description: scope, risk, changed files, test evidence, screenshots/preview and rollback notes.
- Secrets never enter commits, issues, logs or screenshots.

## Iteration protocol
1. Read latest status, decisions, roadmap and repository tree.
2. Pick the smallest approved deliverable from the current phase.
3. Make changes on a suitable non-production branch.
4. Run relevant validation in the available environment; report unrun tests clearly.
5. Commit/PR, review results, obtain user signoff for phase transitions.
6. Update `docs/DECISIONS.md` and phase progress with actual evidence.
7. Deploy to a preview environment only when integration and credentials exist; production requires explicit approval.

## Required quality gates (once code exists)
- Formatting, static linting and TypeScript compilation.
- API unit/integration tests, database migration tests, negative authorization tests.
- Cross-tenant isolation regression tests.
- Frontend basic accessibility and happy-path browser tests.
- Dependency and secret scans.
- Staging backup/restore and deployment rollback dry-run before production.

**Current reality:** Project planning only; tests and Vercel deployment have not started. No automation runs in the background between active sessions.

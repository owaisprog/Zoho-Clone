# P4 Batch 55 — Real CI React owner organization switcher

Five subphases:
1. A signed organization-selection controller fetches owned organizations from R54, chooses a verified ID (never an arbitrary URL value), and resets the prior tenant before changing context.
2. Its async epoch guard drops late responses; denied/suspended ownership clears every stale metric, member, invitation and audit row, and a pending write prevents a tenant switch.
3. A real responsive React/Tailwind organization-selection toolbar wraps the existing R53 functional owner workspace and remounts its confirmation state per selected organization.
4. Frontend regression and server-side React markup tests cover tenant switching, revocation, malicious IDs, stale async calls, mutation locking, and no JWT/ciphertext exposure.
5. Signed fictional owner/recipient HTTP -> restricted PostgreSQL integration with multiple active owners and organizations, a real invitation issued in the selected tenant, switching without data crossover, unapproved organization denial, revoked ownership clearing, and React SSR.

Production Next.js routes remain unmounted. No customer identity or real Auth0, SMTP, Neon writes, staging, merge or deployment. Formal original acceptance 0/727, P4 NO_GO. Existing release gates, risks, decisions and owner review remain open.

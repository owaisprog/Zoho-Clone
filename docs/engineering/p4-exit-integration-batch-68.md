# P4 Batch 68 — owner CRM follow-up due work queue

Five implementation subphases:
1. Guarded CI-only PostgreSQL **all-lead due work queue** SQL function, sorted by due date and task UUID, filtering completed tasks and enforcing fresh ownership plus transaction-local restricted actor/tenant.
2. Signed HMAC cursor bound to the exact owner organization and due-through date, 10-minute expiry and 20+1 keyset pages; dedicated Express read route, unmounted from live backend.
3. Strict Next.js-compatible fetch client and controller with deadline filter, pagination, stale-response clearing on org switch/revocation, and direct CAS task completion through the R64 durable audit mechanism.
4. Accessible React due queue panel with company name, lead task, due date, due-through filter, loaded count, load-more, confirmation and optional navigate-to-lead callback.
5. Executable RS256→signed HTTP→restricted PostgreSQL→React SSR exercise with 25 open tasks on two leads, 20+5, deferred out-of-window task, completing an older page task and persisted immutable task events, second-tenant isolation, member/revoked-owner/cursor rejection.

**Formal acceptance status:** engineering evidence only; original 727 P1.09 test inventory remains 0 formally executed, 10 release gates OPEN, P4 NO_GO. Missing real Auth0 integration, approved production role permissions, verified file private storage, staging rollback and signed owner exit. No commercial data, main merge, Neon writes, preview/production deployment or live route activation. Task pages are keyset views, not immutable snapshots.

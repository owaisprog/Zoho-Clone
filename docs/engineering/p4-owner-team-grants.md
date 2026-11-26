# P4 owner-only team grants (disposable CI)
Base PR #155 exact 826b5efd933515149b375e0438ab222313352627 passed all four jobs in run 45892010009. The logs confirmed signed fictional identity, owner-only existing sales grant toggles, replay, concurrent CAS, audit and revoked membership denial.

Five implementation subphases:
1. Tenant-keyed team and team-grant tables with composite foreign keys and forced RLS.
2. Owner-only existing unmanaged grant listing and toggles, using the existing restricted writer and NOLOGIN definer, serializable CAS and the shared immutable audit/request ledger.
3. Isolated signed fictional-identity HTTP endpoints, bounded keyset page and React team editor with strict projection and scoped exact-request retry.
4. Fresh effective team membership check from the read-only runtime role; current identity, user, membership, organization, team and grant must all be active/verified as appropriate. This boolean is not a CRM entitlement.
5. Real disposable PostgreSQL/RS256 HTTP regression: unauthorized owner/member/cross-tenant/managed or missing grant denial, shared role/team request replay conflict, concurrent CAS, pagination, privilege drift and next-read revocation.

The React editor is intentionally unmounted; server-bound writer transport, live Auth0 MFA, production role policy and reviewed external migrations remain unapproved. No arbitrary team creation, team transfers, managed flag mutations, owner changes, invitations or production data. The existing role editor and directory stay intact. SQL in db/tests is never for Neon or staging. The fresh read is a database function tested through the restricted runtime; no live team entitlement route or CRM authorization is introduced. Actual CI status must be verified on the exact PR head. This engineering work is not formal acceptance; 10 gates, 14 risks, 12 decisions and the original formal acceptance inventory remain open. No merge, deployment, live database changes or paid resources. P4 NO_GO.

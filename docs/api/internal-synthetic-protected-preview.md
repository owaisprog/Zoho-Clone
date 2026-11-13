# Test-only internal lead API — P3.16

**Never mounted by the normal Express process.** The only test-injected prefix is
`/api/v1/internal/organizations/:orgId/leads`, where orgId is a hint checked against a fresh synthetic membership.

| Operation | Success | Preconditions |
|---|---|---|
| GET list | 200, `{scope:"synthetic-only",data:[…],count:n}` | Fixture-verified actor, active matching membership, sales reader/editor, tenant+record-scope predicate before count |
| GET by id | 200 or privacy-preserving 404 | Same; no cross-org or non-owned row disclosure |
| POST create | 201 initial / 200 replay, `{scope,data,replayed}` | Sales editor, body exactly organization/contact/email with fictional names and example.com email, required demo Idempotency-Key |
| PATCH status | 200, `{scope,data,replayed}` | Sales editor, record predicate, exact stage-only patch, If-Match quoted version and demo Idempotency-Key; sequential transitions only |

An explicitly injected integration-test resolver converts a limited fake fixture-session token into a synthetic actor. This is **not** OIDC, production login, JWT/session verification or safe for real user data. Spoofing headers against the default server receives a 404.

Errors are generic and exclude all body fields, credentials, titles and private details. 401 unauthenticated, 403 denied role, 404 missing/inaccessible tenant or record, 409 version/idempotency conflict, 422 invalid transition, 503 resolver failure. No real data, real DB, durable idempotency, job workers, provider integration or payment endpoints.

OPEN-001 (identity), OPEN-002 (IDs), OPEN-003 (record permissions) remain unapproved. G-EXT/G-COM remain blocked.

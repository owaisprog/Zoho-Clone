# P4 Batch 95 — identity and formal acceptance preparation

Five slices: separate Auth0 identity configuration boundary; signed-login and session/revocation requirements; fictional configuration syntax checks using R35; exact 108-case P4 acceptance queue from R90; fail-closed evidence contract and tests.

No live identity verification or formal acceptance is performed. Issuer, audience and client ID remain unset until an isolated tenant is explicitly approved. Require separate tenant/client/API, exact issuer/audience/client binding, approved MFA/session/CSRF/logout/revocation policy, restricted test accounts and two-tenant membership isolation. R81 stays unmounted; no live route changes.

Run `node scripts/p4-r95-identity-acceptance.mjs --all` to list the 108 P4-linked pending cases (43 partial references, 65 unmapped). Later-phase cases remain pending. Evidence must record case ID, fixture version, commit/run, timestamp, command, result, defect reference and owner signoff. No formal results are invented. Existing CI executes scripts/*.test.mjs.

This concludes the approved preparation cycle, not formal P4 exit. Next: owner selection of isolated staging topology and cost cap, role/team policy R10-C1–C5 review, approved provider/database configuration and separate migration/deployment authorization. All ten gates, fourteen risks, twelve decisions and 727 original unexecuted cases remain open. No main merge, paid provisioning, deployment or live Neon changes.

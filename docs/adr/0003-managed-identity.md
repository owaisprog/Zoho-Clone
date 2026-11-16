# ADR 0003 — Managed OIDC instead of custom passwords

Status: **DECISION PENDING / OPEN-001** — 2026-11-16
Source: master PDF P3.13 / P4.01–P4.03.

Decision required from product owner: pick a managed OIDC provider
after evaluating issuer/audience, MFA and recovery, organization
membership model, session revocation, region/residency, service limits,
cost, legal terms and support.

Contract:
- Authorization Code + PKCE; server-verified tokens via rotating JWKS,
  issuer, audience, signature, expiry, nonce/state as appropriate.
- HTTP-only, Secure, SameSite cookies; CSRF controls on state-changing
  routes; session rotation, logout and immediate revoke semantics.
- Distinguish global identity subject from organization membership.
- Invitation expiry/single-use, privileged MFA, threat/event auditing.
- Deny everything on provider outage, invalid token or missing scope.

No IdP, real login, live session, JWKS or secret is configured. The
existing injected identity seam is for negative synthetic tests only.
Selecting an actual provider requires the owner's account and consent.

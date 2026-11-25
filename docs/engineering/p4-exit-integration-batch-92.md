# P4 Batch 92 — owner handoff and decision record

**Decision requested: review only. P4 formal exit is NO_GO.** The planned 92-batch engineering cycle reaches its intended checkpoint with this draft PR, conditional on exact-head CI. This is not a claim of complete P4 functionality, formal acceptance, production readiness or authorization to start P5 release. No main merge, deployment, Neon migration, real customer data or paid cloud work is authorized.

## Five handoff slices
1. Reconcile the original 25-subphase ledger with the latest engineering checkpoint.
2. Summarize the ten unchanged release gates and the evidence required to close each.
3. Verify the original 727-case acceptance inventory, 14 risk entries and 12 tracked decisions without closing or rewriting them.
4. Map the eight original P5-linked feature rows to existing partial CRM evidence and concrete remaining work.
5. Deliver an executable fail-closed owner review and a sequenced next-action package. Run `node scripts/p4-r92-owner-handoff.mjs`; it checks repository consistency, not external approvals or actual provider readiness.

## Verified development evidence
- Batch 87: [PR #137](https://github.com/owaisprog/Zoho-Clone/pull/137) · [CI 45591715527](https://github.com/owaisprog/Zoho-Clone/actions/runs/45591715527) · `19764d3cedae0bb8971616aece9346242ed393e8` · 4/4 CI checks passed at that historical head.
- Batch 88: [PR #138](https://github.com/owaisprog/Zoho-Clone/pull/138) · [CI 45592541073](https://github.com/owaisprog/Zoho-Clone/actions/runs/45592541073) · `1aa05c5abc8f11347f01c91a864f878d5eb211a0` · 4/4 CI checks passed at that historical head.
- Batch 89: [PR #139](https://github.com/owaisprog/Zoho-Clone/pull/139) · [CI 45594030334](https://github.com/owaisprog/Zoho-Clone/actions/runs/45594030334) · `1f1c68fcd9e6114aea6fe17dd58efce44c31c93c` · 4/4 CI checks passed at that historical head.
- Batch 90: [PR #140](https://github.com/owaisprog/Zoho-Clone/pull/140) · [CI 45595414104](https://github.com/owaisprog/Zoho-Clone/actions/runs/45595414104) · `e49cddbeb74bf00113ec4105b49e4fa724f4abcc` · 4/4 CI checks passed at that historical head.
- Batch 91: [PR #141](https://github.com/owaisprog/Zoho-Clone/pull/141) · [CI 45595950889](https://github.com/owaisprog/Zoho-Clone/actions/runs/45595950889) · `f279ec17c68d3b5c81aaccd4a2784abcda463ce9` · 4/4 CI checks passed at that historical head.

R87 implemented the isolated Redis/BullMQ bridge; R88 hardened grant invalidation; R89 executed real Chromium tests on a disposable React/Express/PostgreSQL/Redis fixture; R90 mapped 54 distinct original case IDs to partial engineering references (43 of 108 P4-linked cases; 65 unmapped); R91 restored six UUID platform schemas and 16 tables, reconciled a known fixture revocation and verified exact pending job behavior. These are not a single production-compatible system: the legacy CRM candidates and UUID platform fixture schemas remain separate. No normal production route exposes the CI-only candidates.

## Release gates
| Gate | Engineering evidence (partial) | Required remaining evidence |
|---|---|---|
| P4-IDENTITY (OPEN) | R81 provider boundary, R82 mapping, R89 browser fixture | Separate staging Auth0 tenant, exact issuer/audience, MFA, signed login and logout/revocation acceptance |
| P4-TENANT-RLS (OPEN) | R82 UUID schema, R84 restricted API, R88 revocation, R91 restore | Reviewed complete migration set and separate restricted staging runtime, two-tenant RLS proof |
| P4-WRITES (OPEN) | R10 synthetic role/team change and later isolated write candidates | Explicit R10-C1–C5 policy approval, owner-transfer design, reviewed writer grants and real endpoint acceptance |
| P4-STORAGE (OPEN) | R85 fictional quarantine/scan, R88 grant epoch, R89 browser | Private provider and scanner selection, retention and secure signed grants, real approved staging file lifecycle |
| P4-AUDIT (OPEN) | R84 immutable fixture audit, R88–R91 security and recovery | Production audit writer, coverage of all mutations, retention and reviewed redaction/immutability |
| P4-STAGING (OPEN) | R83/R91 disposable restores, R89 browser | Approved isolated staging, private canary, P2/P3 signoff, real rollback, recovery objectives |
| P4-ORIGINAL-ACCEPTANCE (OPEN) | R90 reviewed frozen original inventory | Execute prioritized original cases in their authorized release environments with exact evidence and owner review; later feature cases cannot be run before implementation |
| P4-RISK-DECISIONS (OPEN) | R90 traceability, ADR 0007 and related design approvals | Review all 14 original risks and 12 decisions; record explicit dispositions without overwriting history |
| P4-OWNER-EXIT (OPEN) | Batches through R91 verified in draft PRs | Independent evidence review and explicit owner exit approval only after required gates are satisfied |
| P4-PRODUCTION-RELEASE (OPEN) | No production changes | Separate production authorization, data/legal/provider/operational reviews; not implied by P4 design approval |

## P5 (Sales CRM) handoff, not release approval
Original backlog includes eight P5-linked feature rows (some shared with later phases). Do not start a new production schema or duplicate the existing CRM candidates. Reuse reviewed behavior when an approved staging integration exists. All eight rows remain partial, and the original backlog is unchanged.

| Feature | Existing candidate evidence | Remaining work |
|---|---|---|
| FT-008 Lead CRUD and search | R72, R77 | Lead edit/source/owner changes, assigned-team scope and production migration |
| FT-009 Contact and account CRUD | R69–R70 | Approved fields, complete editable lifecycle, tenant API contracts |
| FT-010 Duplicate candidate warnings | R69–R70 | Candidate review and approved matching algorithm; no silent merges |
| FT-011 Deal and pipeline management | R71, R74, R78 | Configurable pipeline, shared-edit rules, optional agent relation |
| FT-012 Activities and assigned tasks | R75, R78–R79 | Broader parent assignment, revoked-assignee recovery and complete CRUD |
| FT-013 Scoped sales pipeline reports | R74, R79–R80 | Production reconciliation, broader sharing and reporting semantics |
| FT-016 Accessible and responsive CRM UI | R73, R77, R80, R89 | Live Next.js routes and full CRM browser/keyboard/accessibility tests |
| FT-017 Idempotent UX and concurrency | R72, R78 | Full operation coverage, error/replay semantics and formal acceptance |

## Owner review required
- **staging-topology:** Choose isolated staging host, region and monthly cost cap; authorize preparation first, resource creation and deployment separately.
- **identity:** Approve staging Auth0 tenant/client/API, issuer/audience, test identities, MFA, session/CSRF and revocation policy.
- **database:** Approve separate synthetic staging database, reviewed migration set, restricted logins, no CI bootstrap credentials, backup and reconciliation procedure.
- **writes:** Review R10-C1–C5; explicitly decide owner/admin delegation, last-owner transfer and audit/write permissions; approval is design-only unless separately authorized.
- **storage:** Select private object storage and malware scanner, region, encryption, limits, retention, deletion and signed-grant policy.
- **operations:** Approve private ingress, GitHub environment, secrets, artifact pinning, alerting/audit retention and recovery objectives.
- **formal-acceptance:** Approve original-case execution schedule, reviewer and evidence rules, review all risks/decisions, obtain P2/P3/P4 signoff when eligible.
- **production:** Keep separate; no production credentials, customer data, main merge, or external release authorization.

Review [R10-C1–C5](../security/p4-batch10-role-team-change-contract-owner-review.md) and [ADR 0007](../adr/0007-architecture-v1-owner-approval.md). Architecture design decisions are already approved for internal synthetic development; do not ask for them again or reinterpret them as approval to provision real services. Recommended next action: approve a concrete isolated staging preparation plan and review the role/team change proposals, then separately authorize any resource creation or actual migration/deployment. Once that approval exists, implement the full production-compatible migrations, provider adapters and live staging routes with reviewed security, and run the prioritized original acceptance cases with exact case IDs, fixture/schema version, timestamp, command, commit/run, result, defect references and owner signoff. Later-phase cases remain pending until their features exist. Do not simply extend the synthetic batch estimate as a substitute for this owner decision. 

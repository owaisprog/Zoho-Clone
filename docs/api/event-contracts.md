# P1.08 — Internal Domain Event Contracts and Outbox

**Version:** 0.1 — owner-review draft · 2026-11-13  
**Scope:** R0/R1/R2 internal modular monolith domain events; **NO EXTERNAL PROVIDER WEBHOOKS OR PAYMENTS**.  
**Status:** SPECIFICATION ONLY, not a configured broker/Redis/BullMQ queue, event bus, database transaction, producer, consumer, integration or emitted event.  
**Related:** [REST API contract](api-contracts.md), [event catalog CSV](event-catalog.csv), P1.07 domain glossary and P1.06 least-privilege matrix.

## 1. Event envelope (synthetic illustrative JSON)

```json
{
  "schemaVersion": "1.0-draft",
  "eventId": "evt_demo_001",
  "eventType": "merchant.application.stage_changed",
  "organizationId": "org_demo_orchid",
  "aggregate": {
    "kind": "MerchantApplication",
    "id": "app_orch_2",
    "version": 2
  },
  "occurredAt": "2026-11-13T09:00:00Z",
  "actor": {
    "kind": "member",
    "ref": "mem_orch_ops"
  },
  "correlationId": "corr_demo_01",
  "causationId": "cmd_demo_01",
  "payload": {
    "fromStageKey": "draft",
    "toStageKey": "pending_more_info",
    "reasonKey": "synthetic_followup"
  }
}
```

**Fields:** `schemaVersion` is a versioned, immutable event-type schema reference; `eventId` is globally unique for deduplication; `eventType` is one allowlisted name; `organizationId` is tenant scope derived from an authorized command; `aggregate` references a scoped record and monotonic version where applicable; `occurredAt` is server-controlled UTC; `actor` identifies a safe role/member reference, not a token; `correlationId` and `causationId` join related attempts without exposing request contents; `payload` contains only event-specific minimal enum/ref values. Neither eventId nor organizationId alone grants a consumer access.

**Not permitted:** raw passwords, API keys, OIDC access/refresh tokens, PAN/CVV, routing/bank details, KYC/KYB documents, government identity, contact email, private merchant records, application full text, raw provider callback bodies or payment-provider secrets. No generic `data: {}` event with arbitrary user payload.

## 2. Event taxonomy (16 proposed internal event types)

| Event | Release | Aggregate | Safe purpose | Constraint |
|---|---|---|---|---|
| `org.created` | R0 | Organization | Organization identity initialized | NO_PII |
| `membership.invited` | R0 | Invitation | Role allowlist invitation state recorded | NO_EMAIL_IN_PAYLOAD |
| `membership.revoked` | R0 | Membership | Invalidate membership grants and caches | NO_USER_CONTACT_DATA |
| `role.grant_changed` | R0 | RoleGrant | Grant/revoke roles safely | NO_AUTH_TOKENS |
| `entitlement.changed_mock` | R0 | AppEntitlement | Synthetic entitlement changed by internal mock only | NO_PAYMENT_PROVIDER_SUCCESS |
| `crm.lead.created` | R1 | Lead | New synthetic lead created | NO_CONTACT_NAME_EMAIL |
| `crm.deal.stage_changed` | R1 | Deal | Track internal deal state change | NO_PRICE_SECRET_OR_PROCESSOR_STATUS |
| `crm.task.assigned` | R1 | Task | Assign permitted task | NO_PRIVATE_TASK_TEXT |
| `merchant.agent.reassigned` | R2 | AgentAssignment | Revoke former portfolio access | NO_SENSITIVE_MERCHANT_DATA |
| `merchant.application.created` | R2 | MerchantApplication | Internal case created, separate from provider | NO_PROCESSOR_SUBMISSION_CLAIM |
| `merchant.application.stage_changed` | R2 | MerchantApplication | Only internal stage; optimistic concurrency | NO_EXTERNAL_APPROVAL_IMPLIED |
| `merchant.next_action_updated` | R2 | MerchantApplication | Track safe next-action reference only | NO_NOTE_TEXT |
| `merchant.checklist.completed` | R2 | ChecklistItem | Checklist done, no external approval | NO_KYC_DOCUMENTS |
| `security.authorization_denied` | R0-R2 | AuditEvent | Sanitized denied privileged attempt recorded | NO_REQUEST_BODY |
| `crm.import_job.completed` | R1 | ImportJob | Synthetic import status, not full CSV | NO_CSV_CONTENT |
| `crm.export_job.created` | R1 | ExportJob | Export job requested, no URL data | NO_EXPORTED_ROWS |

Events describing an internal sale, checklist, merchant application or demo entitlement **do NOT prove** processor underwriting, payment success, account boarding, activation, charge enablement or settlement.

## 3. Producer/consumer contract

1. Only an authorized Express domain command may produce a business event; validate membership, module entitlement, role, record, field and version checks first.
2. Write state, safe audit metadata and an outbox event **in a single database transaction** when appropriate. Rollback leaves no orphan event or stage history.
3. Outbox worker must hold a **purpose-scoped service grant**, not implicit all-tenant `SYSTEM_WORKER` access. Check tenant relationship and application grant for each action.
4. Proposed delivery is **at-least-once** with a stable `eventId`. Consumer must persist a dedup/inbox key scoped to consumer and event. The same event may arrive twice; business effect must apply once.
5. Ordering guarantee is at most **per aggregate** with monotonically increasing aggregate version, not global total order. Out-of-order or stale state-change events must be rejected, held or re-evaluated; never blindly overwrite newer state.
6. Retry transient failures with bounded exponential backoff and jitter, then quarantine/dead-letter with safe reason, correlation ID and operator review. Poison messages and unknown versions must not be silently dropped or falsely acknowledged as applied.
7. Event-schema evolution must be backward compatible within major version; new required fields/renames need a versioning and migration plan with consumer contract tests.
8. Avoid log payloads and high-cardinality PII; operational trace contains safe event ref, tenant scope, timing, attempt count and reason code. Async jobs cannot revive revoked permissions without rechecking current policy.
9. If an event cannot be published after DB commit, retain outbox row for retry; if consumer fails, keep accurate pending/failed status rather than marking completion.
10. Producers, schemas, consumer privileges, retention, queue technology and transactional storage are final P3/P4/P7 implementation decisions. **No Redis, BullMQ or outbox worker exists yet**.

## 4. Special state boundaries

- `crm.deal.stage_changed` with new stage `won` may request a future internal handoff, but never `merchant.processor_approved`.
- `merchant.application.stage_changed` records only the **internal** provisional application stage. Actual provider status is a separate, restricted, read-only provenance domain in this MVP.
- `merchant.agent.reassigned` signals access invalidation; a former agent's next read must fail even if worker/cache processing lags.
- `entitlement.changed_mock` is expressly a sandbox synthetic operation, not a real webhook or paid subscription confirmation.
- `security.authorization_denied` is a sanitized audit signal, not an invitation for unscoped notification/analytics processors.

## 5. Deferred/forbidden external integration

**No** event listener, external URL, webhook secret, signed checkout, processor boarding event, KYC/KYB upload callback, payouts, settlement, direct card/bank data, terminal provisioning or commercial email delivery is specified as a working service.

A future real processor adapter requires explicit contracts, verification/signatures, replay/idempotency controls, real provider status semantics, privacy requirements and fresh product-owner authorization. The 0/3 unvalidated ISO/POS/PayFac workflows remain a recorded limitation.

## 6. Sample contract validation scenarios (future, NOT RUN)

| Scenario | Expected result |
|---|---|
| Same `eventId` delivered twice | One logical consumer effect; duplicate acknowledged safely |
| Two versions delivered backward | No state regression |
| Invalid `organizationId` on event ref | Reject/quarantine without cross-tenant action |
| Revoked member ref replayed | No new authorized mutation |
| Unknown `eventType` or unsupported major version | Reject or quarantine with safe reason |
| Event payload contains `cardNumber` or full `contactEmail` | Schema rejection; no PII content in log |
| Producer DB transaction rolls back | No published event claiming saved stage |
| Worker fails after commit | Outbox retries; API can show accurate pending state |
| Synthetic approved stage event triggers processing | Forbidden: no actual processor capability |
| Tracing enabled during retry | No raw request/event payload leakage |

## 7. Owner review and follow-on work

- [x] Event taxonomy and safe envelope prepared.
- [x] Proposed transactional outbox/at-least-once/dedup/order/timeout strategy recorded.
- [x] Distinction between internal events and unauthorized external provider webhooks documented.
- [ ] Owner approves event types, envelope and delivery policy as **design only**.
- [ ] P1.09 acceptance traceability maps these events to real future automated tests.
- [ ] P3/P4 later implement and test actual producers, consumers, scoped workers and event schema validation.

**No events emitted, delivered, queued or tested as a result of this document.**

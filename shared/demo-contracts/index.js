/**
 * P3.04 shared *synthetic-only* API contracts.
 * This is NOT a production CRM, KYC, tenant, or permission schema.
 *
 * Strict fixture comparison deliberately refuses external/customer data:
 * a local Express response can only be rendered if it exactly matches the
 * original, allowlisted fictional rows.
 */
export const DEMO_CONTRACT = "internal-fictional-v1";

const leadFields = ["id", "organization", "contact", "email", "stage", "owner"];
const applicationFields = ["id", "name", "category", "stage", "owner", "nextAction", "updatedLabel"];
const applicationStages = new Set(["draft", "needs_more_info", "waiting_demo", "handoff_pending", "active_internal"]);
const leadStages = new Set(["new", "contacted", "qualified"]);

function isObject(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}
function hasFields(input, names) {
  return isObject(input) && Object.keys(input).length === names.length &&
    names.every((key) => Object.prototype.hasOwnProperty.call(input, key));
}
function short(value) {
  return typeof value === "string" && value.length >= 1 && value.length <= 180;
}

export function isSyntheticLead(value) {
  return hasFields(value, leadFields) &&
    typeof value.id === "string" && /^LEAD-DEMO-\d{3}$/.test(value.id) &&
    short(value.organization) && value.organization.includes("Demo") &&
    short(value.contact) && value.contact.startsWith("Example ") &&
    typeof value.email === "string" && /^[a-z0-9-]+@example\.com$/.test(value.email) &&
    leadStages.has(value.stage) && value.owner === "Demo Sales";
}

export function isSyntheticApplication(value) {
  return hasFields(value, applicationFields) &&
    typeof value.id === "string" && /^APP-DEMO-\d{3}$/.test(value.id) &&
    short(value.name) && value.name.startsWith("Demo ") &&
    short(value.category) && applicationStages.has(value.stage) &&
    value.owner === "Demo Operations" &&
    short(value.nextAction) && short(value.updatedLabel) &&
    value.updatedLabel.includes("(demo)");
}

/**
 * Fail closed for the public preview: require the *exact* known fixture
 * values, not just a plausible "demo" prefix. If the API is compromised,
 * unknown free text cannot be injected into this unauthenticated UI.
 */
export function parseSyntheticEnvelope(payload, dataset, expected) {
  if (!hasFields(payload, ["contract", "scope", "dataset", "records"]) ||
      payload.contract !== DEMO_CONTRACT || payload.scope !== "synthetic-only" ||
      payload.dataset !== dataset || !Array.isArray(payload.records) ||
      payload.records.length !== expected.length || expected.length > 25) return null;

  const validate = dataset === "leads" ? isSyntheticLead
    : dataset === "applications" ? isSyntheticApplication : null;
  if (!validate) return null;

  const byId = new Map();
  for (const item of expected) {
    if (!validate(item) || byId.has(item.id)) return null;
    byId.set(item.id, item);
  }
  const seen = new Set();
  for (const item of payload.records) {
    if (!validate(item) || seen.has(item.id)) return null;
    seen.add(item.id);
    const canonical = byId.get(item.id);
    if (!canonical || Object.keys(item).some((key) => item[key] !== canonical[key])) return null;
  }
  return payload.records;
}

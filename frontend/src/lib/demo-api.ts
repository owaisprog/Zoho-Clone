// This module must only be called in Next.js SERVER components.
// P3.02 reads a LOCAL Express endpoint with FIXED fictional data.
// It is not an auth, tenant-isolation, database, or production-data layer.
import {
  DEMO_APPLICATIONS, DEMO_LEADS,
  type DemoApplication, type DemoLead,
} from "./synthetic-data";

export interface DemoDataset<T> {
  records: readonly T[];
  source: "express-demo-api" | "local-fixtures";
}

type DatasetName = "leads" | "applications";

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyFields(record: Record<string, unknown>, fields: readonly string[]): boolean {
  return Object.keys(record).length === fields.length &&
    fields.every((field) => Object.prototype.hasOwnProperty.call(record, field));
}

function shortText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 180;
}

export function isSyntheticLead(value: unknown): value is DemoLead {
  if (!object(value) || !onlyFields(value, ["id", "organization", "contact", "email", "stage", "owner"])) return false;
  return typeof value.id === "string" && /^LEAD-DEMO-\d{3}$/.test(value.id) &&
    shortText(value.organization) && value.organization.includes("Demo") &&
    shortText(value.contact) && value.contact.startsWith("Example ") &&
    typeof value.email === "string" && /^[a-z0-9-]+@example\.com$/.test(value.email) &&
    (value.stage === "new" || value.stage === "contacted" || value.stage === "qualified") &&
    value.owner === "Demo Sales";
}

export function isSyntheticApplication(value: unknown): value is DemoApplication {
  if (!object(value) || !onlyFields(value, ["id", "name", "category", "stage", "owner", "nextAction", "updatedLabel"])) return false;
  return typeof value.id === "string" && /^APP-DEMO-\d{3}$/.test(value.id) &&
    shortText(value.name) && value.name.startsWith("Demo ") &&
    shortText(value.category) &&
    (value.stage === "draft" || value.stage === "needs_more_info" ||
      value.stage === "waiting_demo" || value.stage === "handoff_pending" ||
      value.stage === "active_internal") &&
    value.owner === "Demo Operations" &&
    shortText(value.nextAction) && shortText(value.updatedLabel) &&
    value.updatedLabel.includes("(demo)");
}

async function fetchSynthetic<T>(
  dataset: DatasetName, fallback: readonly T[], validate: (value: unknown) => value is T,
): Promise<DemoDataset<T>> {
  try {
    const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
    const response = await fetch(new URL("/api/v1/demo/" + dataset, base), {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error("Demo API unavailable");
    const payload: unknown = await response.json();
    if (!object(payload) || payload.scope !== "synthetic-only" ||
        payload.dataset !== dataset || !onlyFields(payload, ["scope", "dataset", "records"]) ||
        !Array.isArray(payload.records) || payload.records.length !== fallback.length ||
        !payload.records.every(validate)) {
      throw new Error("Unexpected synthetic demo contract");
    }
    const ids = payload.records.map((row: T) => (row as { id: string }).id);
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate demo identifiers");
    return { records: payload.records as T[], source: "express-demo-api" };
  } catch {
    // Deliberate safe failure: show the explicitly fictional local data, no raw errors.
    return { records: fallback, source: "local-fixtures" };
  }
}

export function getDemoLeads(): Promise<DemoDataset<DemoLead>> {
  return fetchSynthetic("leads", DEMO_LEADS, isSyntheticLead);
}

export function getDemoApplications(): Promise<DemoDataset<DemoApplication>> {
  return fetchSynthetic("applications", DEMO_APPLICATIONS, isSyntheticApplication);
}

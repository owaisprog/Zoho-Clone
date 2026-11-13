// Server-only P3.04 synthetic API bridge.
// This is not an identity, tenant, payment or production-data integration.
import {
  DEMO_CONTRACT, parseSyntheticEnvelope,
  type DemoLead, type DemoApplication, type DemoTask,
} from "@zoho-clone/demo-contracts";
import { DEMO_APPLICATIONS, DEMO_LEADS, DEMO_TASKS } from "./synthetic-data";
import { safeLocalApiBase } from "./local-api-url";
export { isSyntheticLead, isSyntheticApplication } from "@zoho-clone/demo-contracts";

export interface DemoDataset<T> {
  records: readonly T[];
  source: "express-demo-api" | "local-fixtures";
}

async function fetchSynthetic<T extends DemoLead | DemoApplication | DemoTask>(
  dataset: "leads" | "applications" | "tasks", fallback: readonly T[],
): Promise<DemoDataset<T>> {
  try {
    const base = safeLocalApiBase(process.env.API_INTERNAL_URL);
    if (!base) throw new Error("Local demo URL configuration rejected");
    const url = new URL("/api/v1/demo/" + dataset, base);
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error("Local fictional API unavailable");
    const payload: unknown = await response.json();
    const records = parseSyntheticEnvelope(payload, dataset, fallback);
    if (!records) throw new Error("Unexpected fictional fixture contract: " + DEMO_CONTRACT);
    return { records, source: "express-demo-api" };
  } catch {
    // Never render an unvalidated response or leak a backend error to browser.
    return { records: fallback, source: "local-fixtures" };
  }
}

export function getDemoLeads(): Promise<DemoDataset<DemoLead>> {
  return fetchSynthetic("leads", DEMO_LEADS);
}

export function getDemoApplications(): Promise<DemoDataset<DemoApplication>> {
  return fetchSynthetic("applications", DEMO_APPLICATIONS);
}

export function getDemoTasks(): Promise<DemoDataset<DemoTask>> {
  return fetchSynthetic("tasks", DEMO_TASKS);
}

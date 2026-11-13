// This request occurs only on the Next.js server and is NOT an auth check.
// Process health does not mean a database or permissions engine is healthy.
import { safeLocalApiBase } from "./local-api-url";

interface HealthBody {
  status?: unknown;
  scope?: unknown;
  checks?: { process?: unknown };
}

export interface BackendStatus {
  online: boolean;
  label: string;
}

export async function getBackendStatus(): Promise<BackendStatus> {
  try {
    const url = safeLocalApiBase(process.env.API_INTERNAL_URL);
    if (!url) throw new Error("Rejected non-local demo API");
    const response = await fetch(new URL("/api/v1/health", url), {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error("Process health request failed");
    const result = (await response.json()) as HealthBody;
    if (
      result.status !== "ok" ||
      result.scope !== "synthetic-only" ||
      result.checks?.process !== "up"
    ) {
      throw new Error("Unexpected process health contract");
    }
    return { online: true, label: "API process running" };
  } catch {
    // The UI remains functional using only explicitly fictional local fixtures.
    return { online: false, label: "API not running locally" };
  }
}

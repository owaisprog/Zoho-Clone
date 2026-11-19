/**
 * P3.11: in-process bounded synthetic telemetry, not a public metrics API.
 * Never record paths, query strings, IPs, secrets, identities, tokens or headers.
 */
export type SafeHttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "OTHER";
export type HttpStatusGroup = "2xx" | "3xx" | "4xx" | "5xx" | "other";
export type DurationBand = "lt100ms" | "lt500ms" | "lt2000ms" | "gte2000ms";
export interface SafeHttpBucket {
  method: SafeHttpMethod;
  statusGroup: HttpStatusGroup;
  duration: DurationBand;
  count: number;
}
const allowedMethods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

export function categorizeHttpSample(method: unknown, status: unknown, durationMs: unknown): Omit<SafeHttpBucket, "count"> {
  const normalizedMethod: SafeHttpMethod =
    typeof method === "string" && allowedMethods.has(method) ? method as SafeHttpMethod : "OTHER";
  const statusGroup: HttpStatusGroup =
    typeof status === "number" && Number.isInteger(status) && status >= 200 && status < 600
      ? (Math.floor(status / 100) + "xx") as HttpStatusGroup : "other";
  const ms = typeof durationMs === "number" && Number.isFinite(durationMs)
    ? Math.max(durationMs, 0) : 2000;
  const duration: DurationBand = ms < 100 ? "lt100ms"
    : ms < 500 ? "lt500ms" : ms < 2000 ? "lt2000ms" : "gte2000ms";
  return { method: normalizedMethod, statusGroup, duration };
}

export class SafeRequestMetrics {
  private readonly counts = new Map<string, SafeHttpBucket>();
  observe(method: unknown, status: unknown, durationMs: unknown): void {
    const bucket = categorizeHttpSample(method, status, durationMs);
    const key = [bucket.method, bucket.statusGroup, bucket.duration].join("|");
    const previous = this.counts.get(key);
    this.counts.set(key, { ...bucket, count: Math.min(1_000_000_000, (previous?.count ?? 0) + 1) });
  }
  /** Only an owner-approved admin-only exporter may access a snapshot later. */
  snapshot(): readonly SafeHttpBucket[] {
    return [...this.counts.values()].map(item => ({ ...item }))
      .sort((a, b) => [a.method, a.statusGroup, a.duration].join("|")
        .localeCompare([b.method, b.statusGroup, b.duration].join("|")));
  }
}

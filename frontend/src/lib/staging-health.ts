/** Server-only synthetic health bridge; never sends credentials or follows redirects. */
export type StagingHealth = { status: "disabled" | "unavailable" | "alive"; ready: false };
export function stagingApiOrigin(env: NodeJS.ProcessEnv): URL | null {
  if (env.VERCEL !== "1" || env.VERCEL_ENV !== "preview" ||
      env.P4_VERCEL_SYNTHETIC_PREVIEW !== "true") return null;
  const raw = env.P4_STAGING_API_ORIGIN;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(u.hostname) ||
        u.port || u.username || u.password || u.pathname !== "/" || u.search || u.hash) return null;
    return u;
  } catch { return null; }
}
export async function getStagingHealth(env: NodeJS.ProcessEnv = process.env,
  transport: typeof fetch = fetch): Promise<StagingHealth> {
  const base = stagingApiOrigin(env);
  if (!base) return {status:"disabled",ready:false};
  try {
    const response = await transport(new URL("/health/live",base), {
      method:"GET", cache:"no-store", redirect:"error", credentials:"omit",
      signal:AbortSignal.timeout(3000),
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
      return {status:"unavailable",ready:false};
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" ||
        Object.keys(payload).sort().join(",") !== "scope,status" ||
        !("status" in payload) || payload.status !== "alive" ||
        !("scope" in payload) || payload.scope !== "synthetic-only")
      return {status:"unavailable",ready:false};
    return {status:"alive",ready:false};
  } catch { return {status:"unavailable",ready:false}; }
}

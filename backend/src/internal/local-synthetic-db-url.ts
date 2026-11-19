/**
 * P3.05: Only the disposable local synthetic PostgreSQL instance can be
 * addressed by this smoke script. No production, staging, remote host or
 * admin/owner connection may pass this gate.
 */
export function requireLocalSyntheticDatabaseUrl(raw: string | undefined): string {
  if (!raw) throw new Error("LOCAL_SYNTHETIC_DATABASE_URL_REQUIRED");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("LOCAL_SYNTHETIC_DATABASE_URL_INVALID"); }
  const safeSchema = url.search === "" ||
    (url.searchParams.size === 1 && url.searchParams.get("schema") === "synthetic");
  if (url.protocol !== "postgresql:" ||
      url.hostname !== "127.0.0.1" ||
      url.port !== "5433" ||
      url.pathname !== "/zoho_clone_synthetic" ||
      url.username !== "p3_preview_runtime" ||
      !url.password ||
      url.hash !== "" ||
      !safeSchema) {
    throw new Error("LOCAL_SYNTHETIC_DATABASE_URL_REJECTED");
  }
  return raw;
}

/**
 * P3.05/06: Strict, synthetic-only Neon Prisma smoke connection.
 *
 * This function does not prove the remote database is disposable. The owner
 * MUST use a freshly created dev-only Neon project and database. It prevents
 * accidently pointing this command at a local/production/privileged connection.
 */
export function requireNeonSyntheticDatabaseUrl(raw: string | undefined): string {
  if (!raw) throw new Error("NEON_SYNTHETIC_DATABASE_URL_REQUIRED");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("NEON_SYNTHETIC_DATABASE_URL_INVALID"); }
  const host = url.hostname.toLowerCase();
  const isNeonEndpoint = /^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech$/.test(host);
  const params = [...url.searchParams.entries()];
  const tlsOnly = params.some(([k, v]) => k === "sslmode" && (v === "require" || v === "verify-full")) &&
    params.every(([k, v]) =>
      (k === "sslmode" && (v === "require" || v === "verify-full")) ||
      (k === "channel_binding" && v === "require")
    );
  if (url.protocol !== "postgresql:" ||
      !isNeonEndpoint ||
      url.port !== "" && url.port !== "5432" ||
      url.pathname !== "/zoho_clone_synthetic" ||
      url.username !== "p3_neon_reader" ||
      url.password.length < 12 ||
      url.hash !== "" ||
      !tlsOnly) {
    throw new Error("NEON_SYNTHETIC_DATABASE_URL_REJECTED");
  }
  return raw;
}

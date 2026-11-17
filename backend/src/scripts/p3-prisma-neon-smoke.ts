/**
 * P3.05/06: owner-controlled remote Neon DEVELOPMENT branch only.
 * Refuses any URL that is not on neon.tech / read-only role / synthetic DB.
 * Runs the exact same RLS + tenant/owner isolation tests as local CI.
 *
 * This script does not seed, migrate, truncate or mutate the database.
 */
import { requireNeonSyntheticDatabaseUrl } from "../internal/neon-synthetic-db-url.js";
import { verifySyntheticPrismaReadOnly } from "./p3-prisma-local-smoke.js";

if (process.argv[1]?.endsWith("/p3-prisma-neon-smoke.js")) {
  (async () => {
    const url = requireNeonSyntheticDatabaseUrl(process.env.DATABASE_URL);
    await verifySyntheticPrismaReadOnly(url, "p3_neon_reader");
  })()
    .then(() => console.info("P3.05/06 Neon synthetic Prisma read-only RLS smoke: PASS"))
    .catch(() => {
      // Never reveal cloud hostname, credentials, data or driver exceptions.
      console.error("P3.05/06 Neon synthetic Prisma smoke: FAIL (no details logged)");
      process.exitCode = 1;
    });
}

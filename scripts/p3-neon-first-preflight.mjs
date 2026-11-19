#!/usr/bin/env node
/**
 * P3.08 - Docker-free developer preflight.
 * No credentials are read or printed: checks only existence of local env files.
 * No database migration, identity request, network call or cloud mutation.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export function inspectDeveloperWorkspace(root, options = {}) {
  const major = options.nodeMajor ?? Number(process.versions.node.split(".")[0]);
  const ci = options.ci ?? false;
  const missing = [];
  const required = [
    "package.json", "package-lock.json", "backend/package.json",
    "frontend/package.json", "backend/db/schema.prisma",
    "backend/.env.neon.example", "frontend/.env.auth0.example",
  ];
  for (const path of required) {
    if (!existsSync(join(root, path))) missing.push("MISSING_REPO_FILE");
  }
  if (major < 22) missing.push("NODE_22_REQUIRED");
  if (!ci && !existsSync(join(root, "node_modules"))) missing.push("NPM_DEPENDENCIES_NOT_INSTALLED");
  if (!ci && !existsSync(join(root, "backend/.env.neon.local"))) missing.push("NEON_LOCAL_ENV_MISSING");
  return {
    ok: missing.length === 0,
    reasons: [...new Set(missing)],
    auth0ConfiguredLocally: existsSync(join(root, "frontend/.env.local")),
    neonConfiguredLocally: existsSync(join(root, "backend/.env.neon.local")),
    requiresLocalDocker: false,
  };
}

function main(argv) {
  const root = resolve(process.cwd());
  const ci = argv.includes("--ci");
  const verifyNeon = argv.includes("--verify-neon");
  if (verifyNeon && ci) {
    console.error("P3_PREFLIGHT_ARGUMENTS_INVALID");
    return 2;
  }
  const report = inspectDeveloperWorkspace(root, { ci });
  console.info(report.ok ? "P3_NEON_FIRST_PREFLIGHT_PASS" : "P3_NEON_FIRST_PREFLIGHT_FAIL");
  console.info("P3_NEON_LOCAL_FILE_PRESENT=" + report.neonConfiguredLocally);
  console.info("P3_AUTH0_LOCAL_FILE_PRESENT=" + report.auth0ConfiguredLocally);
  console.info("P3_LOCAL_DOCKER_REQUIRED=false");
  for (const reason of report.reasons) console.error(reason);
  if (!report.ok) return 2;
  if (!verifyNeon) return 0;
  // This calls the same explicitly restricted synthetic-only CLI smoke
  // already validated by the owner; it NEVER prints the DATABASE_URL.
  const run = spawnSync("npm", ["run", "smoke:synthetic-neon", "-w", "backend"], {
    cwd: root, stdio: "inherit", shell: false,
  });
  return run.status ?? 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

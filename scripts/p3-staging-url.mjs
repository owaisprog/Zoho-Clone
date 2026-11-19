#!/usr/bin/env node
/**
 * P3.10 staging health verifier input gate.
 * Enforces explicit staging/preview HTTPS hostname; never prints a URL.
 * Does not deploy, read secrets or send HTTP requests.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function requireApprovedStagingUrl(raw) {
  if (typeof raw !== "string" || raw.length > 512 || raw.trim() !== raw) {
    throw new Error("P3_STAGING_URL_INVALID");
  }
  let url;
  try { url = new URL(raw); } catch { throw new Error("P3_STAGING_URL_INVALID"); }
  const host = url.hostname.toLowerCase();
  const label = host.split(/[.-]/);
  const previewHost = label.includes("staging") || label.includes("preview");
  if (url.protocol !== "https:" || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) ||
      !previewHost || host.endsWith(".example.com") || host.endsWith(".example") ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      Boolean(url.username || url.password || url.hash || url.search || url.port) ||
      (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("P3_STAGING_URL_NOT_APPROVED");
  }
  return url.origin;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireApprovedStagingUrl(process.argv[2]);
    console.info("P3_STAGING_URL_INPUT_PASS");
  } catch {
    console.error("P3_STAGING_URL_INPUT_FAIL");
    process.exitCode = 2;
  }
}

#!/usr/bin/env node
/**
 * P3.07 conservative tracked-source secret guard.
 *
 * This is an extra pre-commit/CI safety net, NOT a comprehensive audit.
 * Keep a professional secret scanner / GitHub secret scanning on the P3 gate.
 * Never print matched credential values or the inspected source.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".yml",
  ".yaml", ".sh", ".sql", ".txt", ".toml", ".prisma", ".example",
]);

export function isForbiddenTrackedPath(path) {
  const name = path.split("/").at(-1) ?? "";
  if (/^\.env(?:\.[^/]+)?$/.test(name) &&
      !/^\.env(?:\.[^/]+)?\.example$/.test(name)) return true;
  if (/\.(?:pem|p12|pfx|jks|keystore)$/i.test(name)) return true;
  if (/^(?:id_rsa|id_ed25519|id_ecdsa)$/.test(name)) return true;
  if (/(?:^|\/)(?:service[-_]account[-_]key|gcp[-_]credentials)\.json$/i.test(path)) return true;
  return false;
}

export function findHighConfidenceSecretIndicators(source) {
  const matches = [];
  // A credential-like *signature*, not a generic string such as "password".
  const rules = [
    ["PRIVATE_KEY", /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
    ["GITHUB_TOKEN", /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b/],
    ["GITHUB_FINE_GRAINED_TOKEN", /\bgithub_pat_[a-zA-Z0-9_]{75,}\b/],
    ["AWS_ACCESS_KEY", /\bAKIA[0-9A-Z]{16}\b/],
  ];
  for (const [name, pattern] of rules) {
    if (pattern.test(source)) matches.push(name);
  }

  // Embedded live Neon URLs must never be checked into tracked sources.
  // Intentionally ignore fake placeholder endpoint/password documentation.
  const neonUrl = /postgres(?:ql)?:\/\/[^:\s/'"]+:([^@\s/'"]+)@(ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech)\/[a-z0-9_]+/gi;
  let found;
  while ((found = neonUrl.exec(source)) !== null) {
    const password = found[1] ?? "";
    const host = (found[2] ?? "").toLowerCase();
    if (!/(?:fake|placeholder|example|replace|your_|your-|test|demo|paste)/i.test(password) &&
        !/(?:example|your-|testfixture)/i.test(host)) {
      matches.push("NEON_CONNECTION_CREDENTIAL");
      break;
    }
  }
  return matches;
}

export function inspectTrackedFile(path) {
  if (isForbiddenTrackedPath(path)) return ["SENSITIVE_FILE_PATH"];
  const name = path.split("/").at(-1) ?? "";
  if (!SOURCE_EXTENSIONS.has(extname(name)) && !name.endsWith(".env.example")) return [];
  const bytes = readFileSync(path);
  if (bytes.length > 2_000_000 || bytes.includes(0)) return [];
  return findHighConfidenceSecretIndicators(bytes.toString("utf8"));
}

export function runTrackedSecretCheck() {
  const names = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\u0000")
    .filter(Boolean);
  let bad = 0;
  for (const path of names) {
    const rules = inspectTrackedFile(path);
    if (rules.length) {
      // File path and static rule names only. Never echo matched content.
      console.error("P3_SECRET_SCAN_FAIL: " + path + " [" + rules.join(",") + "]");
      bad++;
    }
  }
  if (bad) {
    console.error("P3_SECRET_SCAN_FAIL: remove tracked credentials; rotate real leaked keys");
    process.exitCode = 1;
  } else {
    console.info("P3_SECRET_SCAN_PASS: tracked source and path checks (limited signatures)");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runTrackedSecretCheck();
}

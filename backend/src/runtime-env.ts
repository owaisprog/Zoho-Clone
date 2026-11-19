import { readAuth0ApiConfiguration } from "./auth/auth0-config.js";

/**
 * P3.07: This real Express entrypoint is ONLY a loopback synthetic preview.
 * Staging and production require a separately approved deployment entrypoint.
 * Fail with fixed non-sensitive codes; never print raw environment values.
 */
export function assertApprovedBackendRuntimeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const profile = env.P3_APP_ENV ?? "local";
  if (profile !== "local" && profile !== "ci") {
    throw new Error("P3_RUNTIME_ENVIRONMENT_NOT_APPROVED");
  }

  const partialAuth0 = Boolean(env.AUTH0_DOMAIN?.trim() || env.AUTH0_AUDIENCE?.trim());
  if (partialAuth0 && readAuth0ApiConfiguration(env) === null) {
    throw new Error("P3_AUTH0_CONFIGURATION_INVALID");
  }

  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith("NEXT_PUBLIC_") &&
      /(?:SECRET|PASSWORD|PRIVATE|TOKEN|DATABASE_URL|API_KEY)/i.test(name) &&
      Boolean(value?.trim())) {
      throw new Error("P3_PUBLIC_SECRET_ENVIRONMENT_FORBIDDEN");
    }
  }
}

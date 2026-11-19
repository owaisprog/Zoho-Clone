/**
 * P3.07: Public Next.js environment variables get inlined into browser code.
 * Even in this synthetic preview, no secret-like NEXT_PUBLIC value is allowed.
 * The fixed error deliberately does not echo a key name or its secret value.
 */
export function assertNoPublicSecretEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith("NEXT_PUBLIC_") &&
        /(?:SECRET|PASSWORD|PRIVATE|TOKEN|DATABASE_URL|API_KEY)/i.test(name) &&
        Boolean(value?.trim())) {
      throw new Error("P3_PUBLIC_SECRET_ENVIRONMENT_FORBIDDEN");
    }
  }
}

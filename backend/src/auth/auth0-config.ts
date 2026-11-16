/** Identity provider is an explicit owner decision, NOT org permission. */
export interface Auth0ApiConfiguration {
  issuerBaseURL: string;
  audience: string;
}
const DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com$/i;

export function readAuth0ApiConfiguration(env: NodeJS.ProcessEnv = process.env): Auth0ApiConfiguration | null {
  const domain = env.AUTH0_DOMAIN?.trim() ?? "";
  const audience = env.AUTH0_AUDIENCE?.trim() ?? "";
  if (!domain && !audience) return null;
  if (!DOMAIN.test(domain) || !audience || audience.length > 256 ||
      /\s/.test(audience) || !/^(https:\/\/|urn:)/.test(audience)) return null;
  return { issuerBaseURL: `https://${domain}/`, audience };
}

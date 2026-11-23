/**
 * Auth0 remains optional. Require a complete private web configuration,
 * and the same audience shape the Express API can validate. Never expose
 * client secrets in NEXT_PUBLIC variables or authorize tenants here.
 */
export interface Auth0WebConfiguration {
  domain: string;
  audience: string;
}
const AUTH0_DOMAIN_RE=/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com$/i;
const AUDIENCE_RE=/^(?:https:\/\/[^\s]+|urn:[A-Za-z0-9:._/-]+)$/;
export function readAuth0WebConfiguration(
 env:Readonly<Record<string,string|undefined>>=process.env,
):Auth0WebConfiguration|null{
 const domain=env.AUTH0_DOMAIN?.trim()??"";
 const audience=env.AUTH0_AUDIENCE?.trim()??"";
 if(!domain&&!audience&&!env.AUTH0_CLIENT_ID&&
  !env.AUTH0_CLIENT_SECRET&&!env.AUTH0_SECRET)return null;
 if(!AUTH0_DOMAIN_RE.test(domain)||!AUDIENCE_RE.test(audience)||
  audience.length>256||!env.AUTH0_CLIENT_ID?.trim()||
  !env.AUTH0_CLIENT_SECRET?.trim()||
  !/^[a-f0-9]{64}$/i.test(env.AUTH0_SECRET??""))return null;
 return {domain,audience};
}

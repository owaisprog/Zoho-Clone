import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { readAuth0WebConfiguration } from "./auth0-config";
import { readStageWebBinding } from "./staging-membership";

const staging = readStageWebBinding();
const configuration = process.env.VERCEL === "1" ? staging?.web ?? null : readAuth0WebConfiguration();

// The official Auth0 v4 SDK owns OAuth state, PKCE, cookie and token handling.
// A null client does NOT fall back to a fake signed-in user.
export const auth0 = configuration
  ? new Auth0Client({
      authorizationParameters: {
        audience: configuration.audience,
        scope: staging ? "openid profile email read:identity" : "openid profile email",
      },
      enableAccessTokenEndpoint: false,
    })
  : null;

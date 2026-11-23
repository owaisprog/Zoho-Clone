/**
 * P4 R35: read-only configuration preflight, NOT Auth0 verification.
 * Zero external calls, no secret values in results, NO_GO always.
 */
const DOMAIN=/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com$/;
const AUDIENCE=/^(?:https:\/\/[^\s]+|urn:[A-Za-z0-9:._/-]+)$/;
const hex64=/^[a-f0-9]{64}$/i;
function localOrigin(raw){
 try{
  const url=new URL(raw);
  return url.protocol==="http:"&&
   ["127.0.0.1","localhost"].includes(url.hostname)&&
   Boolean(url.port)&&
   (url.pathname==="/"||url.pathname==="")&&
   !url.username&&!url.password&&!url.search&&!url.hash;
 }catch{return false;}
}
const PUBLIC_SECRET=/(?:SECRET|PASSWORD|PRIVATE|TOKEN|DATABASE_URL|API_KEY)/i;
export function evaluateP4R35IdentityPreflight(env={}){
 const issues=[];
 const add=(check,code)=>{if(!check)issues.push(code);};
 add(["local","ci"].includes(env.P3_APP_ENV??"local"),
  "RUNTIME_PROFILE_NOT_APPROVED");
 const domain=env.AUTH0_DOMAIN;
 const audience=env.AUTH0_AUDIENCE;
 add(typeof domain==="string"&&DOMAIN.test(domain),
  "AUTH0_DOMAIN_INVALID");
 add(typeof audience==="string"&&audience.length<=256&&
  AUDIENCE.test(audience),"AUDIENCE_INVALID");
 add(typeof env.AUTH0_CLIENT_ID==="string"&&
  env.AUTH0_CLIENT_ID.trim().length>=3&&env.AUTH0_CLIENT_ID.length<=128,
  "WEB_CLIENT_ID_MISSING");
 add(typeof env.AUTH0_CLIENT_SECRET==="string"&&
  env.AUTH0_CLIENT_SECRET.trim().length>=8,
  "WEB_CLIENT_SECRET_MISSING");
 add(typeof env.AUTH0_SECRET==="string"&&hex64.test(env.AUTH0_SECRET),
  "WEB_COOKIE_SECRET_INVALID");
 add(localOrigin(env.APP_BASE_URL),"WEB_LOCAL_ORIGIN_INVALID");
 add(localOrigin(env.API_INTERNAL_URL),"INTERNAL_API_LOCAL_ORIGIN_INVALID");
 add(typeof env.AUTH0_DOMAIN==="string"&&
  env.AUTH0_DOMAIN===env.AUTH0_EXPECTED_API_DOMAIN,
  "BACKEND_ISSUER_DOMAIN_MISMATCH");
 add(typeof audience==="string"&&
  audience===env.AUTH0_EXPECTED_API_AUDIENCE,
  "BACKEND_AUDIENCE_MISMATCH");
 const leaking=Object.entries(env).some(([key,value])=>
  key.startsWith("NEXT_PUBLIC_")&&
  PUBLIC_SECRET.test(key)&&typeof value==="string"&&value.trim()!=="");
 add(!leaking,"PUBLIC_CREDENTIAL_EXPOSURE");
 // CI never receives/reuses a real service token or network access.
 add(env.P4_ALLOW_LIVE_IDENTITY!=="true",
  "LIVE_IDENTITY_ACTIVATION_NOT_APPROVED");
 const blocked=Object.freeze([...new Set(issues)].sort());
 return Object.freeze({
  status:blocked.length?"BLOCKED":"LOCAL_IDENTITY_CONFIGURATION_SHAPE_COMPLETE",
  checked:"SYNTAX_ONLY",
  release:"NO_GO",
  liveAuth0Verified:false,
  stagingApproved:false,
  formalAcceptanceExecuted:0,
  issueCodes:blocked,
 });
}
function assertCiFixture(){
 if(process.argv.includes("--ci")){
  const base={
   P3_APP_ENV:"ci",AUTH0_DOMAIN:"fixture.us.auth0.com",
   AUTH0_AUDIENCE:"urn:zoho-clone:fixture",AUTH0_CLIENT_ID:"fixture-web",
   AUTH0_CLIENT_SECRET:"fixture_not_a_real_secret",
   AUTH0_SECRET:"a".repeat(64),APP_BASE_URL:"http://127.0.0.1:3000",
   API_INTERNAL_URL:"http://127.0.0.1:4000",
   AUTH0_EXPECTED_API_DOMAIN:"fixture.us.auth0.com",
   AUTH0_EXPECTED_API_AUDIENCE:"urn:zoho-clone:fixture",
  };
  const good=evaluateP4R35IdentityPreflight(base);
  const mismatch=evaluateP4R35IdentityPreflight({
   ...base,AUTH0_EXPECTED_API_AUDIENCE:"urn:other",
  });
  const leaked=evaluateP4R35IdentityPreflight({
   ...base,NEXT_PUBLIC_AUTH0_CLIENT_SECRET:"must-not-print",
  });
  const incomplete=evaluateP4R35IdentityPreflight({});
  if(good.status!=="LOCAL_IDENTITY_CONFIGURATION_SHAPE_COMPLETE"||
    mismatch.issueCodes.includes("BACKEND_AUDIENCE_MISMATCH")===false||
    leaked.issueCodes.includes("PUBLIC_CREDENTIAL_EXPOSURE")===false||
    incomplete.status!=="BLOCKED"||
    [good,mismatch,leaked,incomplete].some(x=>
     x.release!=="NO_GO"||x.liveAuth0Verified||x.stagingApproved))throw Error(
      "P4_R35_CI_PREFLIGHT_FAILED");
  console.log("P4 R35 Auth0 local config shape and no-public-secret preflight PASS; NO_GO");
 }else if(process.argv[1]?.endsWith("p4-r35-auth0-preflight.mjs")){
  throw Error("P4_R35_NO_REAL_ENV_PREFLIGHT_IN_THIS_SCRIPT");
 }
}
assertCiFixture();

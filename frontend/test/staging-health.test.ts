import {test} from "node:test";
import assert from "node:assert/strict";
import {getStagingHealth,stagingApiOrigin} from "../src/lib/staging-health";
const env={VERCEL:"1",VERCEL_ENV:"preview",P4_VERCEL_SYNTHETIC_PREVIEW:"true",P4_STAGING_API_ORIGIN:"https://fictional-api.vercel.app"};
test("staging health rejects external, credential-bearing and non-preview targets",async()=>{
  for(const origin of ["http://fictional-api.vercel.app","https://example.com","https://fictional-api.vercel.app.example.com","https://user:pass@fictional-api.vercel.app","https://fictional-api.vercel.app/path","https://fictional-api.vercel.app?x=1","https://fictional-api.vercel.app:444"]){
    assert.equal(stagingApiOrigin({...env,P4_STAGING_API_ORIGIN:origin}),null);
  }
  assert.equal(stagingApiOrigin({...env,VERCEL_ENV:"production"}),null);
  const never:typeof fetch=async()=>{throw Error("must not fetch");};
  assert.deepEqual(await getStagingHealth({},never),{status:"disabled",ready:false});
});
test("staging health sends no credentials and accepts only exact synthetic liveness",async()=>{
  const mock:typeof fetch=async(input,options)=>{
    assert.equal(String(input),"https://fictional-api.vercel.app/health/live");
    assert.equal(options?.redirect,"error");
    assert.equal(options?.credentials,"omit");
    assert.equal(options?.headers,undefined);
    return Response.json({status:"alive",scope:"synthetic-only"});
  };
  assert.deepEqual(await getStagingHealth(env,mock),{status:"alive",ready:false});
  const malformed:typeof fetch=async()=>Response.json({status:"alive",scope:"production"});
  assert.deepEqual(await getStagingHealth(env,malformed),{status:"unavailable",ready:false});
});

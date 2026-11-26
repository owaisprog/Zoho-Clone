import {test} from "node:test";
import assert from "node:assert/strict";
import {createLocalMonitor,makeSyntheticEnvelope,readSentryTarget} from "../src/platform/p4-ci-local-monitoring.js";
const base={P4_LOCAL_MONITOR_ENABLED:"true"};
const host="o123.ingest.us.sentry.io",dsn="https://"+"a".repeat(32)+"@"+host+"/123";
const enabled={...base,P4_LOCAL_SENTRY_SEND:"true",P4_LOCAL_SENTRY_OWNER_APPROVAL:"approved",P4_LOCAL_SENTRY_PLAN:"developer-free",P4_LOCAL_SENTRY_DSN:dsn,P4_LOCAL_SENTRY_HOST:host,P4_LOCAL_SENTRY_PROJECT:"123"};
test("default off, refuses unsafe environments and mismatched Sentry DSN",()=>{
 assert.equal(readSentryTarget(base),null);
 assert.equal(readSentryTarget(enabled)?.endpoint,"https://"+host+"/api/123/envelope/");
 for(const override of [{CI:"true"},{GITHUB_ACTIONS:"true"},{VERCEL:"1"},{NODE_ENV:"production"},{P4_STAGE_OWNER_ACTIVATION:"approved"},{P4_LOCAL_MONITOR_ENABLED:"false"},{P4_LOCAL_SENTRY_OWNER_APPROVAL:"pending"},{P4_LOCAL_SENTRY_PLAN:"paid"},{P4_LOCAL_SENTRY_HOST:"other.invalid"},{P4_LOCAL_SENTRY_PROJECT:"124"},{P4_LOCAL_SENTRY_DSN:dsn+"?token=fixture"},{P4_LOCAL_SENTRY_DSN:dsn.replace(host,"localhost")}])
  assert.throws(()=>readSentryTarget({...enabled,...override}),/P4_LOCAL_MONITOR_DENIED/);
});
test("envelope is fixed allowlisted data with correct byte length and event identity",()=>{
 const [head,item,payload]=makeSyntheticEnvelope(dsn,"LOCAL_MONITOR_TEST").trimEnd().split("\n");
 const e=JSON.parse(payload!),h=JSON.parse(head!),i=JSON.parse(item!);
 assert.equal(e.event_id,h.event_id);assert.equal(i.length,Buffer.byteLength(payload!));
 assert.equal(e.message,"LOCAL_MONITOR_TEST");
 for(const key of ["request","user","exception","breadcrumbs","extra","contexts","server_name"])assert.equal(key in e,false);
 assert.throws(()=>makeSyntheticEnvelope(dsn,"private payload" as "LOCAL_MONITOR_TEST"));
});
test("healthy probe makes only fixed loopback requests and expects readiness denied",async()=>{
 const seen:string[]=[];
 const request:typeof fetch=async(url,init)=>{
  seen.push(String(url));assert.equal(init?.redirect,"error");
  const live=String(url).endsWith("/live");
  return Response.json({scope:"synthetic-only",status:live?"alive":"not_ready"},{status:live?200:503});
 };
 assert.equal((await createLocalMonitor(base,request).probe()).status,"passed");
 assert.deepEqual(seen,["http://127.0.0.1:4000/health/live","http://127.0.0.1:4000/health/ready"]);
});
test("disabled reporting never sends and provider failure never retries",async()=>{
 let count=0;
 const request:typeof fetch=async(url,init)=>{
  count++;
  if(String(url).startsWith("http://"))return new Response("fake sensitive fixture",{status:500});
  assert.equal(String(url),"https://"+host+"/api/123/envelope/");
  assert.equal(init?.redirect,"error");assert.equal(String(init?.body).includes("fake sensitive fixture"),false);
  return new Response(null,{status:429});
 };
 const local=createLocalMonitor(base,request);
 assert.equal((await local.probe()).report,"disabled");assert.equal(count,1);
 const cloud=createLocalMonitor(enabled,request);
 assert.equal((await cloud.probe()).report,"rejected");assert.equal(count,3);
 assert.equal(await cloud.sendTest(),"limited");assert.equal(count,3);
});

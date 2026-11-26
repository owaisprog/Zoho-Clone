import {test} from "node:test";
import assert from "node:assert/strict";
import {readStageWorkerConfig,readStagePrivateStorageTarget} from "../src/platform/staging-service-config.js";
const env={P4_STAGE_OWNER_ACTIVATION:"approved",P4_STAGE_SERVICE_PROFILE:"isolated-staging-worker",
 P4_STAGE_REDIS_HOST:"redis.fixture.example",P4_STAGE_REDIS_URL:"rediss://default:fake_fixture@redis.fixture.example:6380/0"};
test("worker config requires separate process, TLS and exact staging host",()=>{
 assert.equal(readStageWorkerConfig(env)?.connection.tls.rejectUnauthorized,true);
 for(const change of [{VERCEL:"1"},{P4_STAGE_OWNER_ACTIVATION:"pending"},{P4_STAGE_REDIS_HOST:"other.fixture.example"},{P4_STAGE_REDIS_URL:env.P4_STAGE_REDIS_URL.replace("rediss:","redis:")}]){
  assert.equal(readStageWorkerConfig({...env,...change}),null);
 }
});
test("private storage config does not claim readiness or allow public buckets",()=>{
 const config={P4_STAGE_OWNER_ACTIVATION:"approved",P4_STAGE_STORAGE_ENABLED:"true",P4_STAGE_STORAGE_PROVIDER:"r2",P4_STAGE_STORAGE_BUCKET:"zoho-clone-staging-fixture",P4_STAGE_STORAGE_PUBLIC_ACCESS:"blocked",P4_STAGE_STORAGE_SCANNER:"required"};
 assert.deepEqual(readStagePrivateStorageTarget(config),{provider:"r2",bucket:"zoho-clone-staging-fixture",privateOnly:true,scannerRequired:true,ready:false});
 for(const change of [{P4_STAGE_STORAGE_PUBLIC_ACCESS:"allowed"},{P4_STAGE_STORAGE_SCANNER:"disabled"},{P4_STAGE_STORAGE_BUCKET:"production"},{P4_STAGE_STORAGE_PROVIDER:"unapproved"}])assert.equal(readStagePrivateStorageTarget({...config,...change}),null);
});

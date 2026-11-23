/**
 * P4 R36: only a fictional dependency/rollback rehearsal in GitHub CI.
 * No account, provider, live URL, DNS, migration or deployment touched.
 */
import assert from "node:assert/strict";
import {rehearseP4R36Readiness,P4R36CiRollbackDrill}
 from "../backend/src/platform/p4-r36-ci-readiness-rehearsal.js";
async function main(){
 const noDeployment=await rehearseP4R36Readiness({
  identity:async()=>true,database:async()=>true,delivery:async()=>true,
 });
 assert.equal(noDeployment.release,"NO_GO");
 assert.equal(noDeployment.canDeploy,false);
 assert.equal(noDeployment.stagingProvisioned,false);
 assert.ok(noDeployment.blockers.includes("OWNER_STAGING_APPROVAL_MISSING"));
 const fault=await rehearseP4R36Readiness({
  identity:async()=>true,database:async()=>{throw Error("private fixture error");},
  delivery:async()=>false,
 });
 assert.ok(fault.blockers.includes("DATABASE_DEPENDENCY_FAILED"));
 assert.ok(fault.blockers.includes("DELIVERY_DEPENDENCY_FAILED"));
 assert.equal(JSON.stringify(fault).includes("private fixture"),false);
 const rollback=new P4R36CiRollbackDrill();
 assert.throws(()=>rollback.simulateRollback());
 rollback.prepareSnapshot();
 rollback.simulateCanary();rollback.injectFailure();rollback.simulateRollback();
 assert.deepEqual(rollback.view(),{
  state:"restored-in-memory",release:"NO_GO",deploymentTriggered:false,
 });
 console.log("P4 R36 synthetic dependency failure and rollback simulation PASS; release NO_GO");
}
main().catch(()=>{console.error("P4 R36 readiness rehearsal FAILED");
 process.exitCode=1;});

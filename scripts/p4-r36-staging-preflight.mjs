/**
 * P4 R36: strict, zero-network staging blueprint and official gate validator.
 * A PASS means the deployment is still correctly BLOCKED, not ready.
 */
import {readFileSync} from "node:fs";
const REQUIRED_FORBIDDEN=["DEPLOY","MIGRATE_NEON","ENABLE_LIVE_AUTH0",
 "SEND_MAIL","MERGE_MAIN","APPROVE_P4_EXIT"];
export function evaluateP4R36StagingBlueprint(blueprint,gates){
 const errors=[];
 const reject=(check,code)=>{if(!check)errors.push(code);};
 reject(blueprint?.version===1&&blueprint?.phase==="P4"&&
  blueprint?.mode==="DRY_RUN_ONLY","BLUEPRINT_INVALID");
 reject(blueprint?.profile==="UNPROVISIONED_STAGING_BLUEPRINT"&&
  blueprint?.publicIngress==="DISABLED"&&blueprint?.releaseDecision==="NO_GO",
  "PUBLIC_STAGING_NOT_BLOCKED");
 reject(blueprint?.approval&&
  Object.keys(blueprint.approval).sort().join(",")==="architecture,operations,productOwner,security"&&
  Object.values(blueprint.approval).every(v=>v===false),
  "OWNER_APPROVAL_REQUIRED");
 reject(blueprint?.dependencies&&
  blueprint.dependencies.auth0?.state==="NOT_CONNECTED"&&
  blueprint.dependencies.postgres?.state==="NOT_CONNECTED"&&
  blueprint.dependencies.delivery?.state==="NOT_CONNECTED"&&
  blueprint.dependencies.recovery?.state==="NOT_TESTED_IN_STAGING",
  "REAL_DEPENDENCY_STATUS_NOT_APPROVED");
 reject(blueprint?.rollback?.snapshotBeforeCutover===true&&
  blueprint.rollback?.restoreDrillRequired===true&&
  blueprint.rollback?.canaryRequired===true&&
  blueprint.rollback?.automaticDeployment===false,
  "ROLLBACK_PLAN_INVALID");
 reject(Array.isArray(blueprint?.forbiddenActions)&&
  REQUIRED_FORBIDDEN.every(action=>blueprint.forbiddenActions.includes(action))&&
  !blueprint?.permittedActions?.includes("DEPLOY"),
  "DEPLOYMENT_ACTION_NOT_BLOCKED");
 reject(blueprint?.formalAcceptance?.originalCases===727&&
  blueprint?.formalAcceptance?.executed===0&&
  blueprint?.formalAcceptance?.ownerAccepted===false,
  "ORIGINAL_ACCEPTANCE_NOT_APPROVED");
 reject(gates?.defaultDecision==="NO_GO"&&
  gates?.originalP109Total===727&&gates?.originalP109Executed===0&&
  gates?.ownerExitApproved===false&&gates?.openRisks===14&&
  gates?.openDecisions===12&&Array.isArray(gates?.gates)&&
  gates.gates.length===10&&gates.gates.every(g=>
   g.status==="OPEN"&&g.acceptanceEvidence===null),
  "OFFICIAL_P4_GATE_INVARIANT_FAILED");
 const codes=Object.freeze([...new Set(errors)].sort());
 return Object.freeze({valid:codes.length===0,mode:"DRY_RUN_ONLY",
  release:"NO_GO",deploymentPermitted:false,issues:codes});
}
function run(){
 if(!process.argv.includes("--ci")){
  throw Error("P4_R36_CI_ONLY_PREFLIGHT");
 }
 const blueprint=JSON.parse(readFileSync(
  new URL("../docs/engineering/p4-r36-staging-blueprint.json",import.meta.url),"utf8"));
 const gates=JSON.parse(readFileSync(
  new URL("../docs/engineering/p4-release-gates.json",import.meta.url),"utf8"));
 const result=evaluateP4R36StagingBlueprint(blueprint,gates);
 if(!result.valid||result.release!=="NO_GO"||result.deploymentPermitted)
  throw Error("P4_R36_STAGING_BLUEPRINT_PRECHECK_FAILED");
 console.log("P4 R36 staging blueprint and official NO_GO release gates PASS (no deployment)");
}
if(process.argv[1]?.endsWith("p4-r36-staging-preflight.mjs"))run();

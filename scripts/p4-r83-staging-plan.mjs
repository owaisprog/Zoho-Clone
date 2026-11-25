import {readFileSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {evaluateP4GateManifest} from "./p4-release-gate-evidence.mjs";
const ROOT=fileURLToPath(new URL("..",import.meta.url));
const approvals=["staging-topology","identity","database","storage","operations","formal-acceptance"];
const checkpoints=[["sdk-boundary","backend/test/p4-r81-provider-tenant.test.ts"],["uuid-runtime","scripts/p4-r82-runtime-migration-smoke.ts"],["database-restore","scripts/p4-r83-db-restore-smoke.ts"],["release-invariants","scripts/p4-release-gate-evidence.mjs"]];
const seq=["APPROVE_ISOLATED_ENVIRONMENT","PIN_ARTIFACT_AND_SCHEMA","BACKUP_AND_VALIDATE_RESTORE","REVIEW_EXPAND_ONLY_MIGRATION","PRIVATE_CANARY","VERIFY_IDENTITY_AND_TENANT_ISOLATION","RUN_FORMAL_ACCEPTANCE","OWNER_REVIEW"];
const stops=["UNAPPROVED_ENVIRONMENT","MISSING_BACKUP","INVALID_ARTIFACT_DIGEST","AUTHORIZATION_FAILURE","TENANT_ISOLATION_FAILURE","RESTORE_FAILURE","UNRESOLVED_ACCEPTANCE_FAILURE"];
const forbidden=["DEPLOY","MIGRATE_NEON","ENABLE_LIVE_AUTH0","MERGE_MAIN","APPROVE_P4_EXIT"];
export function evaluateR83(plan,gates,exists=existsSync,read=readFileSync){
 const errors=[],check=(v,code)=>{if(!v)errors.push(code);};
 check(plan?.version===1&&plan.phase==="P4"&&plan.scope==="PREPARATION_ONLY"&&plan.decision==="NO_GO"&&plan.stagingProvisioned===false&&plan.deploymentPermitted===false,"PREPARATION_SCOPE_CHANGED");
 check(plan?.originalAcceptance?.planned===727&&plan.originalAcceptance.formalExecuted===0&&plan.originalAcceptance.ownerAccepted===false,"ACCEPTANCE_NOT_AUTHORIZED");
 check(Array.isArray(plan?.requiredApprovals)&&plan.requiredApprovals.length===approvals.length&&approvals.every(id=>plan.requiredApprovals.filter(x=>x?.id===id&&x.state==="OPEN"&&typeof x.ownerAction==="string"&&x.ownerAction.length>=20).length===1),"APPROVALS_MISSING_OR_CHANGED");
 check(Array.isArray(plan?.checkpoints)&&plan.checkpoints.length===checkpoints.length&&checkpoints.every(([id,path])=>plan.checkpoints.filter(x=>x?.id===id&&x.evidence===path&&x.classification==="CI_ONLY").length===1&&exists(resolve(ROOT,path))),"EVIDENCE_REFERENCE_INVALID");
 check(JSON.stringify(plan?.sequence)===JSON.stringify(seq),"UNSAFE_CUTOVER_SEQUENCE");
 check(JSON.stringify(plan?.stopConditions)===JSON.stringify(stops),"STOP_CONDITIONS_CHANGED");
 check(JSON.stringify(plan?.forbidden)===JSON.stringify(forbidden),"FORBIDDEN_ACTIONS_CHANGED");
 check(evaluateP4GateManifest(gates,exists,read).valid===true,"OFFICIAL_GATES_INVALID");
 return Object.freeze({valid:errors.length===0,decision:"NO_GO",deploymentPermitted:false,issues:Object.freeze(errors)});
}
if(process.argv[1]?.endsWith("p4-r83-staging-plan.mjs")){
 if(!process.argv.includes("--ci"))throw Error("R83_PREPARATION_ONLY");
 const plan=JSON.parse(readFileSync(resolve(ROOT,"docs/engineering/p4-r83-staging-plan.json"),"utf8")),gates=JSON.parse(readFileSync(resolve(ROOT,"docs/engineering/p4-release-gates.json"),"utf8"));
 const out=evaluateR83(plan,gates);console.log(JSON.stringify(out));if(!out.valid)process.exitCode=1;
}

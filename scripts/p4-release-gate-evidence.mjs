#!/usr/bin/env node
/**
 * P4 B20 conservative release-readiness evaluator.
 * It checks locally verifiable engineering evidence, but cannot approve any
 * owner, vendor, production/security or original P1.09 acceptance gate.
 * No secrets, no networking and no GitHub mutation.
 */
import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
export const REQUIRED_GATE_IDS=Object.freeze([
 "P4-IDENTITY","P4-TENANT-RLS","P4-WRITES","P4-STORAGE",
 "P4-AUDIT","P4-STAGING","P4-ORIGINAL-ACCEPTANCE",
 "P4-RISK-DECISIONS","P4-OWNER-EXIT","P4-PRODUCTION-RELEASE",
]);
export const ENGINEERING_CHECKS=Object.freeze([
 ["build-boundary","scripts/p4-ci-compiled-boundary.mjs"],
 ["source-boundary","scripts/p4-ci-route-isolation.mjs"],
 ["normal-app-denial","backend/test/p4-r19-public-app-denial.test.ts"],
 ["tenant-rls","backend/db/tests/013_p4_r7_approved_permission_rehearsal.sql"],
 ["read-only-audit","backend/src/platform/p4-r15-ci-audit-page.ts"],
 ["signed-key-rotation","backend/src/platform/p4-r17-ci-audit-keyring.ts"],
 ["real-postgres-smoke","backend/src/scripts/p4-ci-r17-audit-rotation-smoke.ts"],
 ["phase-progress-ledger","docs/engineering/p4-official-progress-ledger.md"],
]);
function isObject(x){return x!==null&&typeof x==="object"&&!Array.isArray(x);}
function safePath(path){
 return typeof path==="string"&&/^(?:docs\/engineering|backend\/(?:src|test|db)|scripts)\/[a-z0-9/_-]+\.(?:md|json|mjs|ts|sql)$/.test(path)&&
  !path.includes("..");
}
export function evaluateP4GateManifest(manifest,fileExists=existsSync,read=readFileSync){
 const errors=[];
 if(!isObject(manifest))return Object.freeze({decision:"NO_GO",valid:false,errors:["MANIFEST_INVALID"],checks:[],gates:[]});
 if(manifest.version!==1||manifest.phase!=="P4"||
  manifest.scope!=="development-only"||manifest.defaultDecision!=="NO_GO"||
  manifest.readinessClaim!=="NOT_PRODUCTION_READY"||
  manifest.ownerExitApproved!==false||manifest.originalP109Executed!==0||
  manifest.originalP109Total!==727||manifest.openRisks!==14||
  manifest.openDecisions!==12||!Array.isArray(manifest.gates))
  errors.push("INVALID_RELEASE_BASELINE");
 const items=Array.isArray(manifest.gates)?manifest.gates:[];
 const ids=new Set();
 const gateResults=[];
 for(const gate of items){
  if(!isObject(gate)||typeof gate.id!=="string"||ids.has(gate.id)||
    !REQUIRED_GATE_IDS.includes(gate.id)||gate.status!=="OPEN"||
    gate.acceptanceEvidence!==null||
    typeof gate.requirement!=="string"||gate.requirement.length<10||
    !safePath(gate.reference)){
   errors.push("INVALID_OR_APPROVED_GATE");
   continue;
  }
  ids.add(gate.id);
  const exists=fileExists(resolve(ROOT,gate.reference));
  if(!exists)errors.push("GATE_REFERENCE_MISSING");
  gateResults.push(Object.freeze({id:gate.id,status:"OPEN",referencePresent:exists}));
 }
 if(items.length!==REQUIRED_GATE_IDS.length||
  ids.size!==REQUIRED_GATE_IDS.length||
  REQUIRED_GATE_IDS.some(id=>!ids.has(id)))errors.push("INCOMPLETE_GATE_REGISTRY");
 const checks=ENGINEERING_CHECKS.map(([id,path])=>{
  const present=fileExists(resolve(ROOT,path));
  if(!present)errors.push("ENGINEERING_EVIDENCE_MISSING");
  return Object.freeze({id,present});
 });
 const workflowPath=resolve(ROOT,".github/workflows/p3-scaffold.yml");
 if(!fileExists(workflowPath))errors.push("WORKFLOW_MISSING");
 else{
  const workflow=String(read(workflowPath,"utf8"));
  const expected=[
   "node scripts/p4-ci-route-isolation.mjs",
   "node scripts/p4-ci-compiled-boundary.mjs",
   "npm run typecheck","npm run test","npm run build",
   "npm audit --omit=dev --audit-level=critical",
   "node backend/dist/scripts/p4-ci-r17-audit-rotation-smoke.js",
  ];
  if(expected.some(x=>!workflow.includes(x)))errors.push("REQUIRED_CHECK_NOT_WIRED");
 }
 return Object.freeze({
  decision:"NO_GO",valid:errors.length===0,
  errors:Object.freeze([...new Set(errors)].sort()),
  checks:Object.freeze(checks),
  gates:Object.freeze(gateResults),
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let report;
 try{
  const manifest=JSON.parse(readFileSync(resolve(ROOT,"docs/engineering/p4-release-gates.json"),"utf8"));
  report=evaluateP4GateManifest(manifest);
 }catch{
  report={decision:"NO_GO",valid:false,errors:["MANIFEST_UNREADABLE"],checks:[],gates:[]};
 }
 // Bounded metadata only. No secrets or arbitrary file bodies in stdout.
 console.log(JSON.stringify({
  decision:report.decision,valid:report.valid,errors:report.errors,
  engineeringChecks:report.checks.filter(x=>x.present).length,
  requiredEngineeringChecks:ENGINEERING_CHECKS.length,
  openGateCount:report.gates.length,
  originalAcceptanceCasesExecuted:0,
  ownerExitApproved:false,
 }));
 if(!report.valid)process.exitCode=1;
}

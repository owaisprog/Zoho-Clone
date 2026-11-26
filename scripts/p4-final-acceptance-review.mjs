import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {parseP4R21Csv} from "./p4-acceptance-traceability.mjs";
import {evaluateR92,loadR92} from "./p4-r92-owner-handoff.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const expected=["PERM-T008","PERM-T010","AC-107","AC-108","AC-058","PERM-T027","DOM-T010"];
export function evaluateFinalIncrement(m,inventory,baseline,script){
 if(!m||m.version!==1||m.scope!=="DISPOSABLE_CI_ENGINEERING_ONLY"||m.decision!=="NO_GO"||m.formalAccepted!==false||m.formalExecuted!==0||
  m.base?.pr!==158||m.base.sha!=="6f8733492e1441c46008015beb8b52ccb2c7e35e"||m.base.run!==45910201662||m.base.verifiedJobs!==4||
  m.script!=="scripts/p4-stage-acceptance-recovery.ts"||m.openGates!==10||m.openRisks!==14||m.openDecisions!==12)throw Error("P4_FINAL_UNSUPPORTED_CLAIM");
 if(baseline.decision!=="NO_GO"||baseline.formalExecuted!==0||baseline.originalCases!==727||baseline.openGates!==10||baseline.openRisks!==14||baseline.openDecisions!==12)throw Error("P4_FINAL_BASELINE_DRIFT");
 const byId=new Map(parseP4R21Csv(inventory).rows.map(x=>[x.test_id,x]));
 if(!Array.isArray(m.cases)||m.cases.length!==expected.length||!expected.every(id=>m.cases.filter(x=>x.id===id).length===1))throw Error("P4_FINAL_CASE_DRIFT");
 for(const c of m.cases){
  if(byId.get(c.id)?.execution_state!=="NOT_RUN_DOCUMENT_ONLY"||c.coverage!==(c.id==="PERM-T010"?"PARTIAL_READ_DENIAL":"ENGINEERING_SCENARIO")||
   typeof c.limitation!=="string"||c.limitation.length<35||
   !script.includes("P4_ACCEPTANCE_CASE "+c.id+" "+(c.coverage==="PARTIAL_READ_DENIAL"?"PARTIAL_READ_DENIAL":"PASS_ENGINEERING_ONLY")))throw Error("P4_FINAL_EVIDENCE_INVALID");
 }
 return {decision:"NO_GO",originalCases:727,formalExecuted:0,selectedEngineeringScenarios:m.cases.length,formalAccepted:false,openGates:10,openRisks:14,openDecisions:12,scope:"LINKS_ONLY_CHECK_ACTUAL_CI_LOGS"};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const {manifest,baseline}=loadR92();console.log(JSON.stringify(evaluateFinalIncrement(JSON.parse(read("docs/qa/p4-final-acceptance-increment.json")),read("docs/qa/test-inventory.csv"),evaluateR92(manifest,baseline),read("scripts/p4-stage-acceptance-recovery.ts"))));}
 catch{console.error("P4_FINAL_ACCEPTANCE_REVIEW_FAILED");process.exitCode=1;}
}

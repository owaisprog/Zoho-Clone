import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {parseP4R21Csv} from "./p4-acceptance-traceability.mjs";
import {readR90} from "./p4-r90-acceptance-review.mjs";
import {evaluateP4GateManifest,REQUIRED_GATE_IDS} from "./p4-release-gate-evidence.mjs";
import {evaluateR83} from "./p4-r83-staging-plan.mjs";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(ROOT,p),"utf8");
const json=p=>JSON.parse(read(p));
const unique=(rows,key,ids)=>Array.isArray(rows)&&rows.length===ids.length&&ids.every(id=>rows.filter(r=>r?.[key]===id).length===1);
const packages=["staging-topology","identity","database","writes","storage","operations","formal-acceptance","production"];
const p5ids=["FT-008","FT-009","FT-010","FT-011","FT-012","FT-013","FT-016","FT-017"];
const nonempty=x=>typeof x==="string"&&x.length>=20;
export function evaluateR92(m,baseline){
 if(!m||m.version!==1||m.phase!=="P4"||m.scope!=="OWNER_REVIEW_ONLY"||m.plannedBatchMilestone!==92||m.decision!=="NO_GO"||m.p4ExitApproved!==false||m.p5ReleaseAuthorized!==false||m.stagingDeploymentAuthorized!==false||m.productionAuthorized!==false)throw Error("R92_UNSUPPORTED_APPROVAL");
 if(!baseline.gates.valid||!baseline.staging.valid||baseline.acceptance.decision!=="NO_GO"||baseline.acceptance.formalExecuted!==0)throw Error("R92_BASELINE_INVALID");
 const a=baseline.acceptance,counts=m.originalCases;
 if(counts?.total!==727||counts.total!==a.planned||counts.formalExecuted!==0||counts.p4FeatureLinked!==a.p4LinkedCases||counts.p4PartialReferences!==a.p4PartialReferences||counts.p4Unmapped!==a.p4Unmapped)throw Error("R92_ACCEPTANCE_DRIFT");
 const risks=baseline.risks,decisions=baseline.decisions;
 if(risks.length!==14||new Set(risks.map(r=>r.risk_id)).size!==14||risks.some(r=>r.status!=="OPEN")||decisions.length!==12||new Set(decisions.map(d=>d.decision_id)).size!==12||decisions.some(d=>!d.state?.startsWith("OPEN")))throw Error("R92_REGISTER_DRIFT");
 if(!unique(m.gateReview,"id",REQUIRED_GATE_IDS)||m.gateReview.some(g=>g.status!=="OPEN"||g.accepted!==false||!nonempty(g.engineeringEvidence)||!nonempty(g.remaining)||!packages.includes(g.ownerPackage)))throw Error("R92_GATE_REVIEW_INVALID");
 if(!unique(m.ownerPackages,"id",packages)||m.ownerPackages.some(p=>p.state!=="OPEN"||!nonempty(p.action)))throw Error("R92_OWNER_PACKAGE_INVALID");
 const actual=baseline.backlog.filter(f=>f.implementation_roadmap_phase.split("/").includes("P5")).map(f=>f.feature_id);
 if(!unique(m.p5,"id",p5ids)||actual.length!==p5ids.length||p5ids.some(id=>!actual.includes(id))||m.p5.some(f=>f.status!=="PARTIAL_ENGINEERING_EVIDENCE"||f.releaseAuthorized!==false||!nonempty(f.remaining)||typeof f.engineeringEvidence!=="string"||f.engineeringEvidence.length<3))throw Error("R92_P5_SCOPE_DRIFT");
 if(!unique(m.checkpoints,"batch",[87,88,89,90,91])||m.checkpoints.some(c=>c.verifiedJobs!==4||c.scope!=="DISPOSABLE_CI_ENGINEERING"||c.formalAccepted!==false||!Number.isSafeInteger(c.run)||!Number.isSafeInteger(c.pr)||! /^[0-9a-f]{40}$/.test(c.sha)))throw Error("R92_CHECKPOINT_INVALID");
 return {decision:"NO_GO",plannedBatchMilestone:92,openGates:m.gateReview.length,openRisks:risks.length,openDecisions:decisions.length,formalExecuted:0,originalCases:727,p4FeatureLinked:a.p4LinkedCases,p4PartialReferences:a.p4PartialReferences,p4Unmapped:a.p4Unmapped,p5FeatureCount:m.p5.length,p5ReleaseAuthorized:false,stagingDeploymentAuthorized:false,productionAuthorized:false,ownerPackages:m.ownerPackages.length,next:"OWNER_REVIEW_AND_APPROVED_STAGING_PREPARATION"};
}
export function loadR92(){
 const gateManifest=json("docs/engineering/p4-release-gates.json");
 return {manifest:json("docs/engineering/p4-r92-owner-handoff.json"),baseline:{gates:evaluateP4GateManifest(gateManifest),staging:evaluateR83(json("docs/engineering/p4-r83-staging-plan.json"),gateManifest),acceptance:readR90(),risks:parseP4R21Csv(read("docs/product/p1-risk-register.csv")).rows,decisions:parseP4R21Csv(read("docs/product/p1-decision-backlog.csv")).rows,backlog:parseP4R21Csv(read("docs/product/mvp-backlog.csv")).rows}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const {manifest,baseline}=loadR92();console.log(JSON.stringify(evaluateR92(manifest,baseline)));}
 catch{console.error("R92_OWNER_HANDOFF_INVALID");process.exitCode=1;}
}

import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {parseP4R21Csv,evaluateP4R21Acceptance} from "./p4-acceptance-traceability.mjs";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const load=p=>readFileSync(resolve(ROOT,p),"utf8");
export function evaluateR90(inventory,features,legacy,manifest,exists=existsSync){
 const old=evaluateP4R21Acceptance(inventory,features,legacy,exists);
 if(!old.valid)throw Error("R90_BASELINE_INVALID");
 const cases=parseP4R21Csv(inventory).rows,byId=new Map(cases.map(x=>[x.test_id,x]));
 const fs=parseP4R21Csv(features).rows.filter(x=>x.implementation_phase.split("/").includes("P4"));
 const scoped=new Set(fs.flatMap(x=>x.planned_case_ids.split(";")));
 const linked=new Set(legacy.rows.map(x=>x.plannedTestId)),recent=new Set(),batches=new Set();
 if(manifest?.version!==1||manifest.baseline!=="docs/qa/test-inventory.csv"||manifest.decision!=="NO_GO"||manifest.formalExecuted!==0||manifest.ownerAccepted!==false||!Array.isArray(manifest.groups))throw Error("R90_UNSUPPORTED_CLAIM");
 for(const g of manifest.groups){
  if(![82,83,84,87,88,89].includes(g.batch)||batches.has(g.batch)||!Number.isSafeInteger(g.pr)||!Number.isSafeInteger(g.run)||! /^[0-9a-f]{40}$/.test(g.sha)||g.runUrl!=="https://github.com/owaisprog/Zoho-Clone/actions/runs/"+g.run||g.verifiedJobs!==4||g.scope!=="DISPOSABLE_CI_PARTIAL"||g.fixtureVersion!=="R"+g.batch||g.formalExecuted!==false||g.ownerAccepted!==false||!new RegExp("^scripts/p4-r"+g.batch+"-[a-z0-9-]+\\.ts$").test(g.script)||!exists(resolve(ROOT,g.script))||g.command!=="node_modules/.bin/tsx "+g.script||!Array.isArray(g.cases)||g.cases.length<1)throw Error("R90_EVIDENCE_INVALID");
  batches.add(g.batch);
  const seen=new Set();
  for(const pair of g.cases){if(!Array.isArray(pair)||pair.length!==2||!byId.has(pair[0])||seen.has(pair[0])||typeof pair[1]!=="string"||pair[1].length<35)throw Error("R90_CASE_LINK_INVALID");seen.add(pair[0]);recent.add(pair[0]);}
 }
 if(batches.size!==6)throw Error("R90_EVIDENCE_MISSING");
 const allLinked=new Set([...linked,...recent]);
 const rows=cases.map(c=>({id:c.test_id,suite:c.suite,release:c.release,p4FeatureLinked:scoped.has(c.test_id),engineeringEvidence:allLinked.has(c.test_id)?"PARTIAL_REFERENCE":"NOT_MAPPED_IN_REVIEW",formalExecution:"NOT_RUN_DOCUMENT_ONLY",ownerAccepted:false}));
 const p4=rows.filter(x=>x.p4FeatureLinked);
 return {decision:"NO_GO",planned:rows.length,formalExecuted:0,ownerAccepted:false,p4FeatureCount:fs.length,p4LinkedCases:p4.length,p4PartialReferences:p4.filter(x=>x.engineeringEvidence==="PARTIAL_REFERENCE").length,p4Unmapped:p4.filter(x=>x.engineeringEvidence==="NOT_MAPPED_IN_REVIEW").length,allPartialReferences:allLinked.size,rows};
}
export function readR90(){return evaluateR90(load("docs/qa/test-inventory.csv"),load("docs/qa/feature-coverage.csv"),JSON.parse(load("docs/qa/p4-engineering-evidence-links.json")),JSON.parse(load("docs/qa/r90-verified-ci-evidence.json")));}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const {rows,...summary}=readR90();console.log(JSON.stringify(process.argv.includes("--all")?{...summary,rows}:summary));}
 catch{console.error("R90_ACCEPTANCE_REVIEW_FAILED");process.exitCode=1;}
}

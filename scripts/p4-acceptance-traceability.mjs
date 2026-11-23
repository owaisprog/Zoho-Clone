#!/usr/bin/env node
/**
 * P4 Batch 21: evaluate ORIGINAL P1.09 planning inventory and a deliberately
 * limited mapping to CI engineering evidence. A link NEVER executes a case.
 * Read-only; no live data, network or acceptance/owner approval mutation.
 */
import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const INVENTORY_HEADERS=Object.freeze([
 "test_id","suite","source_path","release","test_type","prd_uc",
 "functional_fr","nfr_id","feature_ref","api_operation_id","journey_id",
 "resource_or_entity","scenario","expected_result","execution_state",
]);
const EVIDENCE_CLASS="CI_ONLY_PARTIAL";
function object(v){return v!==null&&typeof v==="object"&&!Array.isArray(v);}
function safePath(v){return typeof v==="string"&&
 /^(?:backend\/(?:src|test|db)|docs\/(?:product|qa|security|api)|scripts)\/[a-z0-9/_.-]+\.(?:sql|ts|mjs|csv|json|md)$/.test(v)&&
 !v.includes("..")&&!v.includes("//");}
/** RFC4180 fields, commas, quoted newlines, and doubled quotes. */
export function parseP4R21Csv(source){
 if(typeof source!=="string"||source.length>2_000_000)throw Error("CSV_INVALID");
 const rows=[];let row=[];let value="";let quoted=false;let closed=false;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quoted){
   if(c==='"'&&source[i+1]==='"'){value+='"';i++;continue;}
   if(c==='"'){quoted=false;closed=true;continue;}
   value+=c;continue;
  }
  if(c==='"'&&!value&&!closed){quoted=true;continue;}
  if(c===","){row.push(value);value="";closed=false;continue;}
  if(c==="\r"||c==="\n"){
   if(c==="\r"&&source[i+1]==="\n")i++;
   if(row.length||value||closed){row.push(value);rows.push(row);}
   row=[];value="";closed=false;continue;
  }
  if(c==='"'||closed)throw Error("CSV_INVALID");
  value+=c;
 }
 if(quoted)throw Error("CSV_INVALID");
 if(row.length||value||closed){row.push(value);rows.push(row);}
 if(rows.length===0)throw Error("CSV_INVALID");
 const headers=rows.shift();
 if(new Set(headers).size!==headers.length)throw Error("CSV_DUPLICATE_HEADER");
 if(rows.some(r=>r.length!==headers.length))throw Error("CSV_COLUMN_MISMATCH");
 return {headers,rows:rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])))};
}
function reject(errors,code){errors.push(code);}
export function evaluateP4R21Acceptance(
 inventoryCsv,featureCsv,links,fileExists=existsSync,
){
 const errors=[];
 let inventory,features;
 try{
  inventory=parseP4R21Csv(inventoryCsv);
  features=parseP4R21Csv(featureCsv);
 }catch{return {valid:false,decision:"NO_GO",errors:["CSV_INVALID"],
  originalCases:0,originalExecuted:0,p4FeatureCount:0,linkedCases:0};}
 if(JSON.stringify(inventory.headers)!==JSON.stringify(INVENTORY_HEADERS))
  reject(errors,"INVENTORY_SCHEMA_DRIFT");
 if(!["feature_id","implementation_phase","planned_case_ids",
  "release"].every(k=>features.headers.includes(k)))
  reject(errors,"FEATURE_SCHEMA_DRIFT");
 const byId=new Map();
 for(const item of inventory.rows){
  if(!item.test_id||byId.has(item.test_id)||
    item.execution_state!=="NOT_RUN_DOCUMENT_ONLY"||
    !safePath(item.source_path)){
   reject(errors,"INVENTORY_STATE_OR_ID_DRIFT");continue;
  }
  byId.set(item.test_id,item);
 }
 if(inventory.rows.length!==727||byId.size!==727)
  reject(errors,"INVENTORY_COUNT_DRIFT");
 const relevant=features.rows.filter(f=>f.implementation_phase?.split("/").includes("P4"));
 if(relevant.length<4||new Set(relevant.map(f=>f.feature_id)).size!==relevant.length)
  reject(errors,"P4_FEATURE_COVERAGE_DRIFT");
 for(const f of relevant){
  if(!f.planned_case_ids||!f.planned_case_ids.split(";").every(id=>byId.has(id)))
   reject(errors,"P4_FEATURE_CASE_REFERENCE_MISSING");
 }
 if(!object(links)||links.version!==1||links.phase!=="P4"||
   links.scope!=="synthetic-engineering-evidence-only"||
   links.originalInventory!=="docs/qa/test-inventory.csv"||
   links.originalPlannedTotal!==727||links.originalExecutedTotal!==0||
   links.evidenceDoesNotExecuteOriginalCases!==true||
   !Array.isArray(links.rows)||links.rows.length!==20)
  reject(errors,"EVIDENCE_MANIFEST_DRIFT");
 const seen=new Set();
 for(const link of Array.isArray(links?.rows)?links.rows:[]){
  if(!object(link)||typeof link.plannedTestId!=="string"||
   seen.has(link.plannedTestId)||!byId.has(link.plannedTestId)||
   link.classification!==EVIDENCE_CLASS||
   link.originalExecutionState!=="NOT_RUN_DOCUMENT_ONLY"||
   link.ownerAccepted!==false||
   !safePath(link.evidencePath)||
   typeof link.limitation!=="string"||link.limitation.length<35){
   reject(errors,"UNSUPPORTED_EVIDENCE_CLAIM");continue;
  }
  seen.add(link.plannedTestId);
  if(!fileExists(resolve(ROOT,link.evidencePath)))
   reject(errors,"MISSING_ENGINEERING_EVIDENCE");
 }
 if(seen.size!==20)reject(errors,"EVIDENCE_LINK_COUNT_DRIFT");
 return Object.freeze({
  valid:errors.length===0,decision:"NO_GO",
  errors:Object.freeze([...new Set(errors)].sort()),
  originalCases:inventory.rows.length,originalExecuted:0,
  p4FeatureCount:relevant.length,linkedCases:seen.size,
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let report;
 try{
  report=evaluateP4R21Acceptance(
   readFileSync(resolve(ROOT,"docs/qa/test-inventory.csv"),"utf8"),
   readFileSync(resolve(ROOT,"docs/qa/feature-coverage.csv"),"utf8"),
   JSON.parse(readFileSync(resolve(ROOT,"docs/qa/p4-engineering-evidence-links.json"),"utf8")),
  );
 }catch{report={valid:false,decision:"NO_GO",errors:["INPUT_UNREADABLE"],
  originalCases:0,originalExecuted:0,p4FeatureCount:0,linkedCases:0};}
 console.log(JSON.stringify(report));
 if(!report.valid)process.exitCode=1;
}

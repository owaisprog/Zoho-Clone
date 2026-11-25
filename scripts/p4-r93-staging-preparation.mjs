import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { evaluateR92, loadR92 } from "./p4-r92-owner-handoff.mjs";
const ROOT=fileURLToPath(new URL("..",import.meta.url));
const slots=["web","api","worker","postgres","redis","identity","storage","scanner"];
const controls=["private-ingress","separate-identities","restricted-database","outbound-deny","pinned-artifacts","rollback","redacted-logs"];
const exact=(a,b)=>Array.isArray(a)&&a.length===b.length&&new Set(a).size===b.length&&b.every(x=>a.includes(x));
export function prepareStaging(p,baseline){
 if(baseline?.decision!=="NO_GO"||baseline.openGates!==10||baseline.formalExecuted!==0)throw Error("R93_BASELINE");
 if(p?.version!==1||p.scope!=="PREPARATION_ONLY"||p.data!=="SYNTHETIC_ONLY"||p.provision!==false||p.deploy!==false||p.migrate!==false||p.merge!==false)throw Error("R93_SCOPE");
 if(p.host!==null||p.region!==null||p.monthlyCostCap!==null||p.environmentApproved!==false)throw Error("R93_UNAPPROVED_TOPOLOGY");
 if(!exact(p.services,slots)||!exact(p.controls,controls))throw Error("R93_INCOMPLETE_BOUNDARY");
 if(p.publicIngress!==false||p.liveCredentials!==false||p.externalSideEffects!==false||p.releaseAuthorized!==false)throw Error("R93_UNSAFE");
 const digest=createHash("sha256").update(JSON.stringify(p)).digest("hex");
 return Object.freeze({decision:"NO_GO",preparationAuthorized:true,provisionAuthorized:false,deployAuthorized:false,digest,services:slots.length,controls:controls.length,openGates:10});
}
export function runR93(){const {manifest,baseline}=loadR92();return prepareStaging(JSON.parse(readFileSync(resolve(ROOT,"docs/engineering/p4-r93-staging-preparation.json"),"utf8")),evaluateR92(manifest,baseline));}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(runR93()));

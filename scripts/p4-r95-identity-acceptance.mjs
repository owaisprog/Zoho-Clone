import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {runR94} from "./p4-r94-migration-review.mjs";
import {readR90} from "./p4-r90-acceptance-review.mjs";
import {evaluateP4R35IdentityPreflight} from "./p4-r35-auth0-preflight.mjs";
const checks=["signed-login","issuer-audience-client","mfa-session","logout-revocation","two-tenant-membership","negative-access"],fields=["caseId","fixtureVersion","commit","run","timestamp","command","result","defectReference","ownerSignoff"];
const root=fileURLToPath(new URL("..",import.meta.url));
export function prepareR95(m,db,inventory){
 if(db?.decision!=="NO_GO"||db.executionAuthorized!==false||db.writerAuthorized!==false)throw Error("R95_DB_BASELINE");
 if(m?.version!==1||m.scope!=="OFFLINE_PREPARATION_ONLY"||m.liveAuth0!==false||m.deploy!==false||m.formalExecution!==false||m.ownerAccepted!==false)throw Error("R95_SCOPE");
 const i=m.identity;
 if(!i||Object.keys(i).sort().join(",")!=="audience,clientId,issuer,mfaApproved,sessionPolicyApproved,tenantApproved"||i.issuer!==null||i.audience!==null||i.clientId!==null||i.tenantApproved!==false||i.mfaApproved!==false||i.sessionPolicyApproved!==false)throw Error("R95_IDENTITY_UNAPPROVED");
 if(JSON.stringify(m.checks)!==JSON.stringify(checks)||JSON.stringify(m.evidenceFields)!==JSON.stringify(fields))throw Error("R95_EVIDENCE_CONTRACT");
 if(inventory?.decision!=="NO_GO"||inventory.planned!==727||inventory.formalExecuted!==0||inventory.ownerAccepted!==false||!Array.isArray(inventory.rows)||inventory.rows.length!==727||new Set(inventory.rows.map(r=>r.id)).size!==727||inventory.rows.some(r=>r.formalExecution!=="NOT_RUN_DOCUMENT_ONLY"||r.ownerAccepted!==false))throw Error("R95_ACCEPTANCE_BASELINE");
 const rows=inventory.rows.filter(r=>r.p4FeatureLinked).map(r=>({caseId:r.id,engineeringEvidence:r.engineeringEvidence,status:"PENDING_FORMAL_EXECUTION",ownerSignoff:null}));
 if(rows.length!==108||rows.filter(r=>r.engineeringEvidence==="PARTIAL_REFERENCE").length!==43)throw Error("R95_SCOPE_DRIFT");
 return {decision:"NO_GO",liveIdentityVerified:false,formalExecuted:0,planned:727,p4Queue:rows,evidenceFields:fields};
}
export function checkFictionalIdentity(){
 const f={P3_APP_ENV:"ci",AUTH0_DOMAIN:"fixture.us.auth0.com",AUTH0_AUDIENCE:"urn:zoho-clone:fixture",AUTH0_CLIENT_ID:"fixture-web",AUTH0_CLIENT_SECRET:"fixture_not_a_real_secret",AUTH0_SECRET:"a".repeat(64),APP_BASE_URL:"http://127.0.0.1:3000",API_INTERNAL_URL:"http://127.0.0.1:4000",AUTH0_EXPECTED_API_DOMAIN:"fixture.us.auth0.com",AUTH0_EXPECTED_API_AUDIENCE:"urn:zoho-clone:fixture"};
 const good=evaluateP4R35IdentityPreflight(f);
 const bad=evaluateP4R35IdentityPreflight({...f,AUTH0_EXPECTED_API_AUDIENCE:"urn:wrong"});
 if(good.status!=="LOCAL_IDENTITY_CONFIGURATION_SHAPE_COMPLETE"||good.liveAuth0Verified!==false||good.release!=="NO_GO"||!bad.issueCodes.includes("BACKEND_AUDIENCE_MISMATCH"))throw Error("R95_FIXTURE_CHECK");
 return {scope:"SYNTAX_ONLY",liveVerified:false};
}
export function runR95(){const manifest=JSON.parse(readFileSync(resolve(root,"docs/engineering/p4-r95-identity-acceptance.json"),"utf8"));return {...prepareR95(manifest,runR94(),readR90()),identityFixture:checkFictionalIdentity()};}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {p4Queue,...summary}=runR95();console.log(JSON.stringify(process.argv.includes("--all")?{...summary,p4Queue}:{...summary,p4QueueCount:p4Queue.length}));}

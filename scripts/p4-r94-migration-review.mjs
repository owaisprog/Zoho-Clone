import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {runR93} from "./p4-r93-staging-preparation.mjs";
const root=fileURLToPath(new URL("..",import.meta.url));
const names=["058_p4_r82_ci_uuid_foundation.sql","059_p4_r84_ci_platform.sql","060_p4_r85_ci_files.sql","061_p4_r86_ci_notifications.sql","062_p4_r87_ci_queue.sql","063_p4_r88_ci_grant_epochs.sql"];
const requirements=["review-production-ddl","separate-runtime-and-owner","review-tenant-policies","review-legacy-crm-mapping","verify-backup-restore","owner-migration-authorization"];
export function reviewMigration(m,baseline,read){
 if(baseline?.decision!=="NO_GO"||baseline.provisionAuthorized!==false||baseline.deployAuthorized!==false)throw Error("R94_BASELINE");
 if(m?.version!==1||m.scope!=="OFFLINE_REVIEW_ONLY"||m.execute!==false||m.liveNeon!==false||m.copyLegacyRows!==false||m.writerApproved!==false)throw Error("R94_SCOPE");
 if(JSON.stringify(m.required)!==JSON.stringify(requirements)||m.files?.length!==names.length)throw Error("R94_INVENTORY");
 const entries=names.map((name,i)=>{
  const f=m.files[i],path="backend/db/candidates/"+name;
  if(f?.path!==path||f.order!==i+1||f.disposition!=="CI_ONLY_DO_NOT_APPLY")throw Error("R94_ORDER");
  const sql=read(path);
  if(typeof sql!=="string"||!sql.includes("DISPOSABLE_ONLY")||!sql.includes("zoho_clone_synthetic_ci")||!sql.includes("BEGIN;")||!sql.includes("COMMIT;"))throw Error("R94_CANDIDATE_GUARD");
  return {path,sha256:createHash("sha256").update(sql).digest("hex"),disposition:f.disposition};
 });
 return {decision:"NO_GO",executionAuthorized:false,legacyCopyAuthorized:false,writerAuthorized:false,entries,required:requirements};
}
export function runR94(){const read=p=>readFileSync(resolve(root,p),"utf8");return reviewMigration(JSON.parse(read("docs/engineering/p4-r94-migration-review.json")),runR93(),read);}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(runR94()));

/** Disposable-only direct outbox processing; no transport is an authority.
 * A hosted trigger may eventually wake a restricted database worker, but this
 * module is deliberately unavailable from the Express/Vercel entrypoints.
 */
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {parseWakeup,wakeupJobId,type Wakeup} from "./p4-r87-ci-queue.js";
import type {Delivery} from "./p4-r86-ci-notifications.js";
type Outbox={due():Promise<Wakeup[]>;deliver(input:Wakeup):Promise<Delivery>};
const deny=()=>{throw Error("P4_CI_OUTBOX_PUMP_DENIED");};
function guard(env:NodeJS.ProcessEnv){
 assertP4V1CiPrismaEnvironment(env);
 if(env.P4_R87_REDIS_CI!=="true"||env.P4_DIRECT_OUTBOX_CI!=="true"||
    env.VERCEL!==undefined||env.VERCEL_ENV!==undefined||env.NODE_ENV==="production")return deny();
}
export async function pumpCiOutbox(db:Outbox,env:NodeJS.ProcessEnv=process.env){
 guard(env);
 const jobs=await db.due();
 if(!Array.isArray(jobs)||jobs.length>20)return deny();
 // Validate the entire batch before executing any effect.
 const unique=new Map<string,Wakeup>();
 for(const item of jobs){const wake=parseWakeup(item);unique.set(wakeupJobId(wake),wake);}
 const outcomes:Record<Delivery,number>={empty:0,delivered:0,cancelled:0,retry:0,dead:0};
 for(const wake of unique.values()){
  guard(env);
  // SQL transaction remains authoritative for current tenant, authorization,
  // attempt and replay. No direct email or external effect is performed here.
  const result=await db.deliver(wake);
  if(!Object.hasOwn(outcomes,result))return deny();
  outcomes[result]++;
 }
 return Object.freeze({processed:unique.size,...outcomes});
}

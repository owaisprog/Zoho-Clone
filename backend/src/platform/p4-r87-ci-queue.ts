/** Disposable-only Redis/BullMQ wakeup bridge. Redis is not an authority. */
import pg from "pg";
import {Queue,Worker,type Job} from "bullmq";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {Delivery} from "./p4-r86-ci-notifications.js";
export type Wakeup=Readonly<{organizationId:string;id:string;attempt:number}>;
const queueName="p4-r87-notification-wake";
const deny=()=>{throw Error("P4_R87_QUEUE_UNAVAILABLE");};
export function parseWakeup(v:unknown):Wakeup{
 if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).sort().join(",")!=="attempt,id,organizationId")return deny();
 const x=v as Record<string,unknown>;
 if(!isCanonicalUuidV4(x.organizationId)||!isCanonicalUuidV4(x.id)||typeof x.attempt!=="number"||!Number.isInteger(x.attempt)||x.attempt<0||x.attempt>2)return deny();
 return Object.freeze({organizationId:x.organizationId,id:x.id,attempt:x.attempt});
}
export function wakeupJobId(v:Wakeup){const x=parseWakeup(v);return x.organizationId+"-"+x.id+"-"+x.attempt;}
function guard(env:NodeJS.ProcessEnv){assertP4V1CiPrismaEnvironment(env);if(env.P4_R87_REDIS_CI!=="true")return deny();}
export class P4R87CiOutbox{
 private readonly pool:pg.Pool;
 constructor(private readonly env:NodeJS.ProcessEnv=process.env){
  guard(env);this.pool=new pg.Pool({host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",user:"p4_r86_ci_worker",password:"fake_ci_not_for_real_accounts",max:3,connectionTimeoutMillis:2000,statement_timeout:3000});
 }
 async close(){await this.pool.end();}
 private async query<T>(sql:string,params:unknown[],parse:(rows:unknown[])=>T):Promise<T>{
  guard(this.env);let c:pg.PoolClient|undefined,active=false,discard=false;
  try{
   c=await this.pool.connect();await c.query("BEGIN");active=true;
   const check=await c.query("SELECT current_user AS role,session_user AS login,current_database() AS db,(SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit FROM pg_roles WHERE rolname=current_user) AS privileged,(SELECT count(*)::int FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user) AS grants");
   const r=check.rows[0];if(check.rowCount!==1||r?.role!=="p4_r86_ci_worker"||r.login!==r.role||r.db!=="zoho_clone_synthetic_ci"||r.privileged!==false||r.grants!==0)return deny();
   const out=await c.query(sql,params);const value=parse(out.rows);await c.query("COMMIT");active=false;return value;
  }catch{if(c&&active)try{await c.query("ROLLBACK");}catch{discard=true;}return deny();}
  finally{c?.release(discard);}
 }
 async due(){return this.query('SELECT organization_id::text AS "organizationId",id::text,attempt FROM p4_r87_ci.due_jobs()',[],rows=>{if(rows.length>20)return deny();return rows.map(parseWakeup);});}
 async deliver(input:Wakeup):Promise<Delivery>{
  const v=parseWakeup(input);return this.query("SELECT p4_r87_ci.deliver_job($1,$2,$3) AS result",[v.organizationId,v.id,v.attempt],rows=>{
   const result=(rows[0] as {result?:unknown}|undefined)?.result;
   if(rows.length!==1||typeof result!=="string"||!["empty","delivered","cancelled","retry","dead"].includes(result))return deny();return result as Delivery;
  });
 }
}
export class P4R87CiQueue{
 private readonly queue:Queue<Wakeup,Delivery,"wake">;
 private readonly worker:Worker<Wakeup,Delivery,"wake">;
 private failed=false;
 constructor(private readonly db:P4R87CiOutbox,private readonly env:NodeJS.ProcessEnv=process.env){
  guard(env);
  const connection={host:"127.0.0.1",port:6379,connectTimeout:2000,retryStrategy:(n:number)=>n<=2?100:null};
  this.queue=new Queue<Wakeup,Delivery,"wake">(queueName,{connection:{...connection,maxRetriesPerRequest:1},prefix:"p4r87ci"});
  this.worker=new Worker<Wakeup,Delivery,"wake">(queueName,async(job:Job<Wakeup,Delivery,"wake">)=>{
   guard(this.env);const data=parseWakeup(job.data);if(job.name!=="wake"||job.id!==wakeupJobId(data))return deny();
   return this.db.deliver(data);
  },{connection:{...connection,maxRetriesPerRequest:null},prefix:"p4r87ci",concurrency:2});
  this.queue.on("error",()=>{this.failed=true;});this.worker.on("error",()=>{this.failed=true;});
 }
 async ready(){guard(this.env);await Promise.all([this.queue.waitUntilReady(),this.worker.waitUntilReady()]);if(this.failed)return deny();}
 async dispatch():Promise<number>{
  guard(this.env);if(this.failed)return deny();
  const jobs=await this.db.due();
  if(jobs.length)await this.queue.addBulk(jobs.map(data=>({name:"wake" as const,data,opts:{jobId:wakeupJobId(data),attempts:1,removeOnComplete:true,removeOnFail:true}})));
  return jobs.length;
 }
 async close(){await this.worker.close();await this.queue.close();}
}

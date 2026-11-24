/** P4 R49 signed cursor owner member listing; restricted disposable CI only. */
import {createHmac,timingSafeEqual} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import type {P4R44CiDirectoryMember} from "./p4-r40-ci-member-roles.js";
export type P4R49Filter="all"|"active"|"revoked";
export type P4R49Page=Readonly<{
 items:readonly P4R44CiDirectoryMember[];nextCursor:string|null;
}>;
type Cursor={org:string;filter:P4R49Filter;search:string;after:string;exp:number};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const EMAIL=/^[a-z0-9._-]+@example[.]com$/;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
function safe(row:Record<string,unknown>):P4R44CiDirectoryMember{
 if(typeof row.user_id!=="string"||!USER.test(row.user_id)||
  (row.email!==null&&(typeof row.email!=="string"||!EMAIL.test(row.email)))||
  (row.role_code!=="SALES_REP"&&row.role_code!=="SALES_MANAGER")||
  !Number.isSafeInteger(row.revision)||(row.revision as number)<0||
  (row.revision as number)>10000000||typeof row.active!=="boolean")
  return fail(503,"UNAVAILABLE");
 return Object.freeze({userId:row.user_id,email:row.email as string|null,
  role:row.role_code,revision:row.revision as number,active:row.active});
}
export class P4R49CiMemberPager{
 constructor(private readonly pool:pg.Pool,private readonly key:Buffer,
  private readonly env:NodeJS.ProcessEnv=process.env,
  private readonly clock:()=>number=Date.now){}
 private guard(){
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!Buffer.isBuffer(this.key)||this.key.length!==32||
   !Number.isSafeInteger(this.clock())||this.clock()<0)
   return fail(503,"UNAVAILABLE");
 }
 private sign(raw:string):string{
  return createHmac("sha256",this.key).update(raw).digest("base64url");
 }
 private cursor(token:string|null,org:string,filter:P4R49Filter,
  search:string):Cursor|null{
  if(token===null)return null;
  if(token.length>1024||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))
   return fail(400,"INVALID_INPUT");
  const [payload,sig]=token.split(".");
  if(!payload||!sig)return fail(400,"INVALID_INPUT");
  const expected=Buffer.from(this.sign(payload),"base64url");
  const received=Buffer.from(sig,"base64url");
  if(received.toString("base64url")!==sig||
   expected.length!==received.length||
   !timingSafeEqual(expected,received))return fail(400,"INVALID_INPUT");
  let input:unknown;
  try{input=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));}
  catch{return fail(400,"INVALID_INPUT");}
  if(!input||typeof input!=="object"||Array.isArray(input))
   return fail(400,"INVALID_INPUT");
  const x=input as Record<string,unknown>;
  if(Object.keys(x).sort().join(",")!=="after,exp,filter,org,search"||
   x.org!==org||x.filter!==filter||x.search!==search||
   typeof x.after!=="string"||!USER.test(x.after)||
   !Number.isSafeInteger(x.exp)||(x.exp as number)<=this.clock()||
   (x.exp as number)>this.clock()+10*60*1000)
   return fail(400,"INVALID_INPUT");
  return x as Cursor;
 }
 async page(actor:P4R28Actor|null,org:unknown,filter:unknown,
  q:unknown,token:unknown):Promise<P4R49Page>{
  this.guard();
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))
   return fail(403,"ACCESS_DENIED");
  if(typeof filter!=="string"||!["all","active","revoked"].includes(filter)||
   typeof q!=="string"||q.length>40||!/^[a-zA-Z0-9._@-]*$/.test(q)||
   (token!==null&&typeof token!=="string"))
   return fail(400,"INVALID_INPUT");
  const status=filter as P4R49Filter,search=q.toLowerCase();
  const after=this.cursor(token as string|null,org,status,search)?.after??null;
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const role=await client.query("SELECT current_user AS role,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(role.rows[0]?.role!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const rows=await client.query(
    "SELECT user_id,email,role_code,revision,active"+
    " FROM p4_r49_ci.owner_member_page($1,$2,$3,$4)",
    [org,status,search,after]);
   if(rows.rows.length>21)return fail(503,"UNAVAILABLE");
   const items=(rows.rows.slice(0,20) as Record<string,unknown>[]).map(safe);
   if(items.some((x,i)=>i>0&&items[i-1]!.userId>=x.userId)||
    new Set(items.map(x=>x.userId)).size!==items.length||
    items.some(x=>(status!=="all"&&x.active!==(status==="active"))||
     (search!==""&&!x.userId.includes(search)&&
      !(x.email??"").includes(search))))
    return fail(503,"UNAVAILABLE");
   let nextCursor:string|null=null;
   if(rows.rows.length===21){
    const last=items.at(-1);
    if(!last)return fail(503,"UNAVAILABLE");
    const value:Cursor={org,filter:status,search,after:last.userId,
     exp:this.clock()+10*60*1000};
    const payload=Buffer.from(JSON.stringify(value)).toString("base64url");
    nextCursor=payload+"."+this.sign(payload);
    if(nextCursor.length>1024)return fail(503,"UNAVAILABLE");
   }
   await client.query("COMMIT");active=false;
   return Object.freeze({items:Object.freeze(items),nextCursor});
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(e.code==="P4900")return fail(400,"INVALID_INPUT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}

import assert from "node:assert/strict";
import {describe,it} from "node:test";
import type {PrismaClient} from "../src/generated/p4-r7-ci/client.js";
import {P4R7CiReadDeniedError} from "../src/platform/p4-r7-ci-prisma-reader.js";
import {readP4R15CiAuditPage} from "../src/platform/p4-r15-ci-audit-page.js";
const ORG="20000000-0000-4000-8000-000000000001";
const FOREIGN="20000000-0000-4000-8000-000000000002";
const ACTOR="10000000-0000-4000-8000-0000000000a1";
const EVT1="70000000-0000-4000-8000-000000000001";
const EVT2="70000000-0000-4000-8000-000000000002";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"5432",
 PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
 PGPASSWORD:"fake_ci_not_for_real_accounts"};
const scope={organizationId:ORG,actorId:ACTOR};
type Opts={
 roles?:string[];noMember?:boolean;noApp?:boolean;foreign?:boolean;
 eventId?:string;actorId?:string;action?:string;date?:unknown;
 records?:number;unsorted?:boolean;
};
function fake(o:Opts={}){
 let queries=0,transactions=0;
 const tx={
  async $executeRawUnsafe(){return 0;},
  async $queryRawUnsafe(sql:string,...params:unknown[]){
   if(sql.includes("set_config("))return [{}];
   if(sql.includes("current_user AS role"))return [{
    role:"p4_v1_ci_runtime",privileged:false,isOwner:false,
    canReadLabel:true,canReadPrivate:false,canWrite:false,
   }];
   queries++;
   const count=o.records??1;
   return Array.from({length:count},(_,i)=>({
    orgId:o.foreign?FOREIGN:ORG,
    eventId:o.eventId??(o.unsorted?EVT1:i%2===0?EVT1:EVT2),
    actorId:o.actorId??ACTOR,
    actionCode:o.action??"role_grant.revoked",
    occurredAt:o.date===undefined?new Date("2026-11-20T10:00:00Z"):o.date,
    cursorProvided:params[0],
    raw_payload_private:{token:'synthetic-hidden-test-only'},
    recipient_email:'private@example.invalid',
   }));
  },
  r7Membership:{async findUnique(){return o.noMember?null:{active:true};}},
  r7RoleGrant:{async findMany(){return (o.roles??["ORG_OWNER"])
   .map(roleCode=>({roleCode,active:true}));}},
  r7AppGrant:{async findMany(){return o.noApp?[]:[{appCode:"platform",active:true}];}},
  r7TeamGrant:{async findMany(){return [];}},
 };
 const prisma={async $transaction<T>(fn:(t:typeof tx)=>Promise<T>){
  transactions++;return fn(tx);
 }} as unknown as PrismaClient;
 return {prisma,get queries(){return queries;},get transactions(){return transactions;}};
}
describe("P4 R15 audit read-only page",()=>{
 it("returns exact immutable safe fields and timestamp with no hidden payload",async()=>{
  const m=fake();
  const page=await readP4R15CiAuditPage(m.prisma,scope,{},ENV);
  assert.deepEqual(page,{data:[{id:EVT1,actorId:ACTOR,
   action:"role_grant.revoked",occurredAt:"2026-11-20T10:00:00.000Z"}],
   nextCursor:null});
  assert.ok(Object.isFrozen(page)&&Object.isFrozen(page.data)&&
   Object.isFrozen(page.data[0]));
  assert.equal(m.queries,1);
 });
 it("limits pages with opaque next cursor from last returned row",async()=>{
  const m=fake({records:2});
  const p=await readP4R15CiAuditPage(m.prisma,scope,{limit:1},ENV);
  assert.equal(p.data.length,1);
  assert.equal(p.nextCursor,EVT1);
 });
 it("permits reviewer but not admin, sales, billing or external roles",async()=>{
  const ok=fake({roles:["SECURITY_REVIEWER"]});
  assert.equal((await readP4R15CiAuditPage(ok.prisma,scope,{},ENV)).data.length,1);
  for(const role of ["ORG_ADMIN","SALES_MANAGER","SALES_REP","BILLING_ADMIN",
   "EXTERNAL_AGENT","PLATFORM_SUPPORT"]){
   const m=fake({roles:[role]});
   await assert.rejects(readP4R15CiAuditPage(m.prisma,scope,{},ENV),
    P4R7CiReadDeniedError);
   assert.equal(m.queries,0);
  }
 });
 it("rejects foreign tenant, actor, malformed event and invalid chronology",async()=>{
  for(const o of [{foreign:true},{actorId:"bad-actor"},
   {eventId:"untrusted"},{action:"file.secret.read"},
   {date:new Date("invalid")},{date:"2026-11-20"}]){
   const m=fake(o);
   await assert.rejects(readP4R15CiAuditPage(m.prisma,scope,{},ENV),
    P4R7CiReadDeniedError);
  }
 });
 it("rejects non-increasing or repeated page event cursor",async()=>{
  const m=fake({records:2,unsorted:true});
  await assert.rejects(readP4R15CiAuditPage(m.prisma,scope,{limit:1},ENV),
   P4R7CiReadDeniedError);
  const n=fake({eventId:EVT1});
  await assert.rejects(readP4R15CiAuditPage(n.prisma,scope,{afterId:EVT1},ENV),
   P4R7CiReadDeniedError);
 });
 it("denies missing membership and disabled platform before SQL",async()=>{
  for(const o of [{noMember:true},{noApp:true}]){
   const m=fake(o);
   await assert.rejects(readP4R15CiAuditPage(m.prisma,scope,{},ENV),
    P4R7CiReadDeniedError);
   assert.equal(m.queries,0);
  }
 });
 it("denies forged cursor, invalid limit, or malformed options before transaction",async()=>{
  for(const opts of [{afterId:"oops"},{limit:0},{limit:21},
   {limit:1.2},{limit:NaN},{afterId:ACTOR.toUpperCase()}]){
   const m=fake();
   await assert.rejects(readP4R15CiAuditPage(m.prisma,scope,opts,ENV),
    P4R7CiReadDeniedError);
   assert.equal(m.transactions,0);
  }
 });
 it("denies non-disposable database configuration",async()=>{
  const m=fake();
  await assert.rejects(readP4R15CiAuditPage(m.prisma,scope,{},
   {...ENV,PGHOST:"production.neon.tech"}),P4R7CiReadDeniedError);
  assert.equal(m.queries,0);
 });
 it("projects only the four approved fields despite extra SQL-returned secrets",async()=>{
  const m=fake();
  const p=await readP4R15CiAuditPage(m.prisma,scope,{},ENV);
  assert.deepEqual(Object.keys(p.data[0]??{}).sort(),
   ["action","actorId","id","occurredAt"]);
  const serialized=JSON.stringify(p);
  for(const hidden of ["raw_payload_private","recipient_email",
   "synthetic-hidden-test-only","private@example.invalid","cursorProvided"])
   assert.equal(serialized.includes(hidden),false);
 });
 it("allowlisted event actions remain the only readable synthetic codes",async()=>{
  for(const action of ["role_grant.revoked","team_grant.revoked","invitation.created"]){
   const m=fake({action});
   const p=await readP4R15CiAuditPage(m.prisma,scope,{},ENV);
   assert.equal(p.data[0]?.action,action);
  }
  for(const action of ["invitation.token","secret.export","role_grant.created",
   "audit.removed",""]){
   const m=fake({action});
   await assert.rejects(readP4R15CiAuditPage(m.prisma,scope,{},ENV),
    P4R7CiReadDeniedError);
  }
 });
 it("denies insufficient role even with active membership and platform grant",async()=>{
  for(const roles of [["ORG_ADMIN"],["SALES_REP"],["SYSTEM_WORKER"],
   ["PLATFORM_SUPPORT"],["BILLING_ADMIN"]]){
   const m=fake({roles});
   await assert.rejects(readP4R15CiAuditPage(m.prisma,scope,{},ENV),
    P4R7CiReadDeniedError);
   assert.equal(m.queries,0);
  }
 });
 it("never uses invalid event timestamps or malformed IDs as audit evidence",async()=>{
  for(const opts of [{actorId:"00000000-0000-0000-0000-000000000000"},
   {eventId:"bad"}, {date:42},{date:null},{action:"raw_provider_body"}]){
   const m=fake(opts);
   await assert.rejects(readP4R15CiAuditPage(m.prisma,scope,{},ENV),
    P4R7CiReadDeniedError);
  }
 });
 it("denies unexpected rows beyond bounded keyset count",async()=>{
  const m=fake({records:3});
  await assert.rejects(readP4R15CiAuditPage(m.prisma,scope,{limit:1},ENV),
   P4R7CiReadDeniedError);
 });
});

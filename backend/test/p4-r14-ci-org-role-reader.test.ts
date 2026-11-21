import assert from "node:assert/strict";
import {describe,it} from "node:test";
import type {PrismaClient} from "../src/generated/p4-r7-ci/client.js";
import {P4R7CiReadDeniedError} from "../src/platform/p4-r7-ci-prisma-reader.js";
import {
 readP4R14CiOrganization,readP4R14CiRoleSummaries,
} from "../src/platform/p4-r14-ci-org-role-reader.js";
const ORG="20000000-0000-4000-8000-000000000001";
const FOREIGN="20000000-0000-4000-8000-000000000002";
const ACTOR="10000000-0000-4000-8000-0000000000a1";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"5432",
 PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
 PGPASSWORD:"fake_ci_not_for_real_accounts"};
const scope={organizationId:ORG,actorId:ACTOR};
type Options={
 roles?:string[];noMember?:boolean;noApp?:boolean;foreign?:boolean;
 orgLabel?:string|null;count?:bigint|null;roleCode?:string;repeat?:boolean;
};
function mock(o:Options={}){
 let queries=0,transactions=0;
 const tx={
  async $executeRawUnsafe(){return 0;},
  async $queryRawUnsafe(sql:string){
   if(sql.includes("set_config("))return [{}];
   if(sql.includes("current_user AS role"))
    return [{role:"p4_v1_ci_runtime",privileged:false,isOwner:false,
      canReadLabel:true,canReadPrivate:false,canWrite:false}];
   queries++;
   if(sql.includes("read_organization"))return [{
    orgId:o.foreign?FOREIGN:ORG,
    displayName:o.orgLabel===undefined?"Demo Orchid":o.orgLabel,
   }];
   const roleRow={
    orgId:o.foreign?FOREIGN:ORG,roleCode:o.roleCode??"SALES_REP",
    activeCount:o.count===undefined?1n:o.count,
   };
   return o.repeat?[roleRow,roleRow]:[roleRow];
  },
  r7Membership:{async findUnique(){return o.noMember?null:{active:true};}},
  r7RoleGrant:{async findMany(){return (o.roles??["ORG_OWNER"])
    .map(roleCode=>({roleCode,active:true}));}},
  r7AppGrant:{async findMany(){return o.noApp?[]:[{appCode:"platform",active:true}];}},
  r7TeamGrant:{async findMany(){return [];}},
 };
 const prisma={async $transaction<T>(fn:(client:typeof tx)=>Promise<T>){
  transactions++;return fn(tx);
 }} as unknown as PrismaClient;
 return {prisma,get queries(){return queries;},get transactions(){return transactions;}};
}
describe("P4 R14 restrictive organization and role metadata",()=>{
 it("owner receives safe frozen organization fields only",async()=>{
  const f=mock();
  const data=await readP4R14CiOrganization(f.prisma,scope,ENV);
  assert.deepEqual(data,{id:ORG,displayName:"Demo Orchid"});
  assert.ok(Object.isFrozen(data));
  assert.equal(f.queries,1);
 });
 it("admin sees organization name, reviewer and billing see only opaque id",async()=>{
  for(const role of ["ORG_ADMIN","SECURITY_REVIEWER","BILLING_ADMIN"]){
   const f=mock({roles:[role],orgLabel:
    role==="ORG_ADMIN"?"Demo Orchid":null});
   const data=await readP4R14CiOrganization(f.prisma,scope,ENV);
   assert.deepEqual(data,role==="ORG_ADMIN"?
    {id:ORG,displayName:"Demo Orchid"}:{id:ORG});
  }
 });
 it("fails closed on faulty SQL over-disclosure or foreign organization",async()=>{
  for(const o of [{roles:["SECURITY_REVIEWER"],orgLabel:"Demo Private"},
    {foreign:true},{orgLabel:"Secret tenant"},
    {roles:["ORG_ADMIN"],orgLabel:null}]){
   const f=mock(o);
   await assert.rejects(readP4R14CiOrganization(f.prisma,scope,ENV),
     P4R7CiReadDeniedError);
  }
 });
 it("denies inactive membership, app, and sales rep before data query",async()=>{
  for(const o of [{noMember:true},{noApp:true},{roles:["SALES_REP"]}]){
   const f=mock(o);
   await assert.rejects(readP4R14CiOrganization(f.prisma,scope,ENV),
     P4R7CiReadDeniedError);
   assert.equal(f.queries,0);
  }
 });
 it("owner/admin role summary returns safe bounded counts without actor IDs",async()=>{
  for(const role of ["ORG_OWNER","ORG_ADMIN"]){
   const f=mock({roles:[role]});
   assert.deepEqual(await readP4R14CiRoleSummaries(f.prisma,scope,20,ENV),
     [{roleCode:"SALES_REP",activeCount:1}]);
  }
 });
 it("security reviewer role policy codes exclude member counts",async()=>{
  const f=mock({roles:["SECURITY_REVIEWER"],count:null});
  const rows=await readP4R14CiRoleSummaries(f.prisma,scope,20,ENV);
  assert.deepEqual(rows,[{roleCode:"SALES_REP"}]);
  assert.ok(Object.isFrozen(rows)&&Object.isFrozen(rows[0]));
 });
 it("denies role count, reserved/admin disclosure and mixed tenant rows",async()=>{
  for(const o of [
   {roles:["SECURITY_REVIEWER"],count:1n},
   {roles:["ORG_ADMIN"],roleCode:"ORG_OWNER"},
   {foreign:true},{count:-1n},{count:1001n},{count:1},
   {roleCode:"BAD_ROOT"},{repeat:true},
  ]){
   const f=mock(o as Options);
   await assert.rejects(readP4R14CiRoleSummaries(f.prisma,scope,20,ENV),
     P4R7CiReadDeniedError);
  }
 });
 it("does not offer IAM role read to billing or sales without matrix R",async()=>{
  for(const role of ["BILLING_ADMIN","SALES_MANAGER","SALES_REP"]){
   const f=mock({roles:[role]});
   await assert.rejects(readP4R14CiRoleSummaries(f.prisma,scope,20,ENV),
     P4R7CiReadDeniedError);
   assert.equal(f.queries,0);
  }
 });
 it("denies malformed limit and non CI environment before database access",async()=>{
  for(const limit of [0,21,1.2,NaN]){
   const f=mock();
   await assert.rejects(readP4R14CiRoleSummaries(f.prisma,scope,limit,ENV),
     P4R7CiReadDeniedError);
   assert.equal(f.transactions,0);
  }
  const f=mock();
  await assert.rejects(readP4R14CiOrganization(f.prisma,scope,
    {...ENV,PGHOST:"prod.neon.tech"}),P4R7CiReadDeniedError);
  assert.equal(f.queries,0);
 });
});

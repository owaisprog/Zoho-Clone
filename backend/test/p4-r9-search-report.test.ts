import assert from "node:assert/strict";
import { describe,it } from "node:test";
import type { PrismaClient } from "../src/generated/p4-r7-ci/client.js";
import {
  searchP4R9CiLeads, readP4R9CiVisibleReport,
} from "../src/platform/p4-r9-ci-search-report.js";
import { P4R7CiReadDeniedError } from "../src/platform/p4-r7-ci-prisma-reader.js";

const ORG="20000000-0000-4000-8000-000000000001";
const FOREIGN="20000000-0000-4000-8000-000000000002";
const ACTOR="10000000-0000-4000-8000-0000000000c1";
const OWNER="10000000-0000-4000-8000-0000000000a1";
const TEAM="30000000-0000-4000-8000-000000000001";
const IDS=[
  "80000000-0000-4000-8000-000000000001",
  "80000000-0000-4000-8000-000000000003",
  "80000000-0000-4000-8000-000000000004",
] as const;
const ENV={
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"5432",
  PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
  PGPASSWORD:"fake_ci_not_for_real_accounts",
};
const scope={organizationId:ORG,actorId:ACTOR};
type Entry={
  orgId:string;id:string;ownerUserId:string;teamId:string;
  assignedUserId:string|null;shareState:string;displayName:string;
  confidentialNote:string;
};
const fixtures:Entry[]=[
  {orgId:ORG,id:IDS[0],ownerUserId:OWNER,teamId:TEAM,
    assignedUserId:null,shareState:"explicit_team",
    displayName:"Demo Shared Orchid Lead",confidentialNote:"HIDDEN"},
  {orgId:ORG,id:IDS[1],ownerUserId:ACTOR,teamId:TEAM,
    assignedUserId:null,shareState:"private",
    displayName:"Demo Rep Owned Lead",confidentialNote:"HIDDEN"},
  {orgId:ORG,id:IDS[2],ownerUserId:OWNER,teamId:TEAM,
    assignedUserId:ACTOR,shareState:"private",
    displayName:"Demo Explicitly Assigned Lead",confidentialNote:"HIDDEN"},
];
type FakeSettings={
  ownerRole?:boolean;noMembership?:boolean;appOff?:boolean;teamOff?:boolean;
  foreign?:boolean;privateLeak?:boolean;countMismatch?:boolean;
};
function fakeDb(settings:FakeSettings={}) {
  let dataQueries=0;
  let countQueries=0;
  let lastSelect:unknown=null;
  const rows=fixtures.map(r=>({...r}));
  if(settings.foreign)rows[0]={...rows[0]!,orgId:FOREIGN};
  if(settings.privateLeak)rows[0]={...rows[0]!,shareState:"private"};
  const tx={
    async $executeRawUnsafe(){return 0;},
    async $queryRawUnsafe(sql:string){
      if(sql.includes("set_config("))return [{}];
      return [{role:"p4_v1_ci_runtime",privileged:false,isOwner:false,
        canReadLabel:true,canReadPrivate:false,canWrite:false}];
    },
    r7Membership:{async findUnique(){
      return settings.noMembership?null:{active:true};
    }},
    r7RoleGrant:{async findMany(){
      return [{roleCode:settings.ownerRole?"ORG_OWNER":"SALES_REP",active:true}];
    }},
    r7AppGrant:{async findMany(){
      return settings.appOff?[]:[{appCode:"crm",active:true}];
    }},
    r7TeamGrant:{async findMany(){
      return settings.teamOff?[]:
        [{orgId:ORG,actorId:ACTOR,teamId:TEAM,active:true,managed:false}];
    }},
    r7Lead:{
      async findMany(opts:{
        where:{orgId:string;displayName?:{contains:string;mode:string};id?:{gt:string}};
        select:unknown;orderBy:unknown;take:number;
      }){
        dataQueries++;lastSelect=opts.select;
        let filtered=[...rows].filter(r=>r.orgId===ORG||settings.foreign);
        if(opts.where.displayName){
          filtered=filtered.filter(r=>r.displayName.toLowerCase().includes(
            opts.where.displayName!.contains.toLowerCase()));
        }
        if(opts.where.id?.gt)filtered=filtered.filter(r=>r.id>opts.where.id!.gt);
        return filtered.slice(0,opts.take);
      },
      async count(){
        countQueries++;
        return settings.countMismatch?4:rows.length;
      },
    },
  };
  const prisma={
    async $transaction<T>(f:(client:typeof tx)=>Promise<T>):Promise<T>{
      return f(tx);
    },
  } as unknown as PrismaClient;
  return {prisma,get dataQueries(){return dataQueries;},
    get countQueries(){return countQueries;},get lastSelect(){return lastSelect;}};
}
describe("P4 Batch 09 D1/D2/D4/D5 synthetic CRM search",()=>{
  it("keyset pages only RLS+P1.06 visible rows with no raw field projection",async()=>{
    const f=fakeDb();
    const first=await searchP4R9CiLeads(f.prisma,scope,{text:"Demo",limit:2},ENV);
    assert.deepEqual(first.records.map(r=>r.id),[IDS[0],IDS[1]]);
    assert.equal(first.nextCursor,IDS[1]);
    const next=await searchP4R9CiLeads(f.prisma,scope,{
      text:"Demo",limit:2,afterId:first.nextCursor!,
    },ENV);
    assert.deepEqual(next.records.map(r=>r.id),[IDS[2]]);
    assert.equal(next.nextCursor,null);
    assert.equal(JSON.stringify(first).includes("HIDDEN"),false);
    assert.deepEqual(Object.keys(first.records[0]!).sort(),["displayName","id"]);
    assert.equal(JSON.stringify(f.lastSelect).includes("confidentialNote"),false);
  });
  it("search is case insensitive and filtering is pushed down to SQL",async()=>{
    const f=fakeDb();
    const found=await searchP4R9CiLeads(f.prisma,scope,{text:"orchid"},ENV);
    assert.deepEqual(found.records.map(r=>r.id),[IDS[0]]);
    assert.equal(found.nextCursor,null);
  });
  it("denies invalid input before any transaction or data read",async()=>{
    const f=fakeDb();
    for(const req of [
      {text:""},{text:"%"},{text:"_"},{text:"  "},
      {text:"select * from private_data"},{text:"x".repeat(41)},
      {text:"Demo",limit:0},{text:"Demo",limit:21},
      {text:"Demo",limit:1.5},{text:"Demo",limit:NaN},
      {text:"Demo",afterId:"not-a-uuid"},
      {text:"Demo",afterId:"80000000-0000-1000-8000-000000000001"},
    ])await assert.rejects(
      searchP4R9CiLeads(f.prisma,scope,req,ENV),
      P4R7CiReadDeniedError,
    );
    assert.equal(f.dataQueries,0);
  });
  it("org owner, revoked member or disabled CRM cannot search",async()=>{
    for(const options of [{ownerRole:true},{noMembership:true},{appOff:true}]){
      const f=fakeDb(options);
      await assert.rejects(searchP4R9CiLeads(f.prisma,scope,{text:"Demo"},ENV),
        P4R7CiReadDeniedError);
      assert.equal(f.dataQueries,0);
    }
  });
  it("denies the whole result on a DB/mock RLS mismatch, not partial leaking",async()=>{
    for(const settings of [{foreign:true},{privateLeak:true},{teamOff:true}]){
      const f=fakeDb(settings);
      await assert.rejects(searchP4R9CiLeads(f.prisma,scope,{text:"Demo"},ENV),
        P4R7CiReadDeniedError);
    }
  });
});
describe("P4 Batch 09 RLS-bounded synthetic CRM report",()=>{
  it("computes only permitted totals, no private fields or cross-role raw counts",async()=>{
    const f=fakeDb();
    const report=await readP4R9CiVisibleReport(f.prisma,scope,ENV);
    assert.deepEqual(report,{
      metric:"visible_crm_leads",totalVisible:3,
      privateVisible:2,explicitlyTeamSharedVisible:1,
    });
    assert.equal(f.countQueries,1);
    assert.equal(f.dataQueries,1);
    assert.equal("rawCount" in report,false);
  });
  it("denies owner-only role and counts that disagree with checked rows",async()=>{
    for(const settings of [{ownerRole:true},{countMismatch:true},
      {privateLeak:true},{foreign:true}]){
      const f=fakeDb(settings);
      await assert.rejects(readP4R9CiVisibleReport(f.prisma,scope,ENV),
        P4R7CiReadDeniedError);
    }
  });
  it("does not run against external/non-CI environments",async()=>{
    const f=fakeDb();
    await assert.rejects(searchP4R9CiLeads(f.prisma,scope,{text:"Demo"},{
      ...ENV,PGHOST:"neon.example",
    }),P4R7CiReadDeniedError);
    await assert.rejects(readP4R9CiVisibleReport(f.prisma,scope,{
      ...ENV,CI:"false",
    }),P4R7CiReadDeniedError);
  });
});

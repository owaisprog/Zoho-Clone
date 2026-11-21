import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveP4V1CiActor, P4V1CiIdentityDeniedError,
  type P4V1CiIdentityLookup,
} from "../src/platform/p4-v1-ci-identity.js";
import {
  readP4V1CiAppManifest, readP4V1CiAuthorizedApp,
  readP4V1CiAuthorizedLead,
  P4V1CiAppDeniedError,
} from "../src/platform/p4-v1-ci-authorized-app.js";
import type { P4VerifiedProviderToken } from "../src/platform/p4-auth0-subject-bridge.js";
import type { PrismaClient } from "../src/generated/p4-v1-ci/client.js";

const EXPECTED = Object.freeze({
  issuer: "https://demo.us.auth0.com/",
  audience: "urn:zoho-clone:demo",
});
const NOW=2_000_000_000;
const ALICE="10000000-0000-4000-8000-0000000000a1";
const ORCHID="20000000-0000-4000-8000-000000000001";
const claims: P4VerifiedProviderToken = {
  issuer: EXPECTED.issuer, subject: "auth0|demo-alice",
  audience: EXPECTED.audience, expiresAtEpochSeconds: NOW + 120,
  cryptographicallyVerified: true,
};
const CI = {
  CI: "true", GITHUB_ACTIONS: "true", PGHOST: "127.0.0.1",
  PGPORT: "5432", PGDATABASE: "zoho_clone_synthetic_ci",
  PGUSER: "demo_ci", PGPASSWORD: "fake_ci_not_for_real_accounts",
};
function subjectLookup(row: {userId:string;emailVerified:boolean}|null) {
  let calls=0;
  const lookup: P4V1CiIdentityLookup={
    async findVerifiedIssuerSubject() { calls++; return row; },
  };
  return {lookup,get calls(){return calls;}};
}
function fakePrisma(args: {
  member?: "OWNER"|"MEMBER"|"MISSING"|"REVOKED";
  crmGrant?: boolean;
  permission?: boolean;
  tamper?: "duplicate"|"foreign_app"|"unknown_permission"|"bad_role";
  recordMissing?: boolean;
  recordForeign?: boolean;
}={}) {
  let reads=0;
  const calls:{model:string;options:unknown}[]=[];
  const tx={
    async $executeRawUnsafe(){return 0;},
    async $queryRawUnsafe(sql:string){
      if(sql.includes("set_config"))return [{}];
      return [{
        role:"p4_v1_ci_runtime",privileged:false,isOwner:false,
        canRead:true,canReadLabel:true,canReadPrivateNote:false,canReadPrivateFile:false,canWrite:false,
      }];
    },
    v1Membership:{
      async findUnique({where}:{where:unknown}){
        calls.push({model:"membership",options:where});
        if(args.member==="MISSING")return null;
        return {role:args.tamper==="bad_role"?"SUPERUSER":args.member??"OWNER",
          active:args.member!=="REVOKED"};
      },
    },
    v1AppGrant:{
      async findMany({where}:{where:unknown}){
        calls.push({model:"app",options:where});
        if(args.tamper==="foreign_app")return [{appCode:"finance",active:true}];
        if(args.tamper==="duplicate")return [{appCode:"crm",active:true},{appCode:"crm",active:true}];
        return [{appCode:"crm",active:args.crmGrant!==false},{appCode:"teams",active:false}];
      },
    },
    v1RolePermission:{
      async findMany({where}:{where:unknown}){
        calls.push({model:"permission",options:where});
        if(args.tamper==="unknown_permission")return [{permissionCode:"platform.superuser"}];
        return args.permission!==false?[{permissionCode:"crm.leads.read"},{permissionCode:"teams.read"}]:[];
      },
    },
    v1Lead:{
      async findUnique({where}:{where:unknown}){
        reads++;calls.push({model:"record",options:where});
        if(args.recordMissing)return null;
        return {id:args.recordForeign?
          "40000000-0000-4000-8000-000000000002":
          "40000000-0000-4000-8000-000000000001",
          displayName:"Demo Orchid Lead",confidentialNote:"Demo PRIVATE"};
      },
      async findMany({where}:{where:unknown}){
        reads++;calls.push({model:"lead",options:where});
        return [{id:"40000000-0000-4000-8000-000000000001",
          displayName:"Demo Orchid Lead",email:"PRIVATE",objectKey:"SECRET"}];
      },
    },
  };
  const prisma={
    async $transaction<T>(cb:(t:typeof tx)=>Promise<T>):Promise<T>{return cb(tx);},
  } as unknown as PrismaClient;
  return {prisma,calls,get reads(){return reads;}};
}

describe("P4.01 exact Auth0 subject to internal UUIDv4 test-only identity",()=>{
  it("accepts only an already SDK-verified exact issuer, audience and mapped verified email",async()=>{
    const l=subjectLookup({userId:ALICE,emailVerified:true});
    assert.equal(await resolveP4V1CiActor(claims,EXPECTED,l.lookup,NOW),ALICE);
    assert.equal(l.calls,1);
  });
  it("denies forged, expired, wrong-issuer, wrong-audience and long-lived claims BEFORE lookup",async()=>{
    const l=subjectLookup({userId:ALICE,emailVerified:true});
    for(const invalid of [
      null,{...claims,cryptographicallyVerified:false as never},
      {...claims,issuer:"https://attacker.example/"},
      {...claims,issuer:"https://other.us.auth0.com/"},
      {...claims,audience:"urn:other:api"},
      {...claims,expiresAtEpochSeconds:NOW},
      {...claims,expiresAtEpochSeconds:NOW+86_401},
      {...claims,subject:"evil email@example.com"},
    ]){
      await assert.rejects(
        resolveP4V1CiActor(invalid,EXPECTED,l.lookup,NOW),
        P4V1CiIdentityDeniedError);
    }
    assert.equal(l.calls,0);
  });
  it("denies unknown, unverified, legacy, or incorrectly typed mapping",async()=>{
    for(const row of [
      null,{userId:ALICE,emailVerified:false},
      {userId:"user_demo_alice",emailVerified:true},
      {userId:"10000000-0000-1000-8000-0000000000a1",emailVerified:true},
    ]){
      await assert.rejects(resolveP4V1CiActor(claims,EXPECTED,
        subjectLookup(row).lookup,NOW),P4V1CiIdentityDeniedError);
    }
  });
  it("never accepts a role or organization claim as identity authorization",async()=>{
    const l=subjectLookup({userId:ALICE,emailVerified:true});
    const mapped=await resolveP4V1CiActor({...claims,role:"PLATFORM_ADMIN",
      tenant:"foreign"} as P4VerifiedProviderToken,EXPECTED,l.lookup,NOW);
    assert.equal(mapped,ALICE);
    assert.equal(typeof mapped,"string");
  });
});
describe("P4.17/13 separate entitlement and RBAC in the fresh Prisma transaction",()=>{
  it("returns enabled CRM and locked teams without granting a direct teams route",async()=>{
    const f=fakePrisma();
    const scope={organizationId:ORCHID,actorId:ALICE};
    const manifest=await readP4V1CiAppManifest(f.prisma,scope,CI);
    assert.deepEqual(manifest.map(a=>[a.code,a.status]),[
      ["crm","available"],["teams","locked"]]);
    const crm=await readP4V1CiAuthorizedApp(f.prisma,scope,"crm",CI);
    assert.equal(crm.leads.length,1);
    assert.deepEqual(crm.leads[0],{
      id:"40000000-0000-4000-8000-000000000001",label:"Demo Orchid Lead"});
    assert.equal(JSON.stringify(crm).includes("PRIVATE"),false);
    assert.equal(JSON.stringify(crm).includes("SECRET"),false);
    assert.equal(f.reads,1);
    assert.equal(f.calls[0]?.model,"membership");
    assert.ok(f.calls.filter(c=>c.model==="app").every(c=>
      JSON.stringify(c.options).includes(ORCHID)));
    assert.ok(f.calls.filter(c=>c.model==="permission").every(c=>
      JSON.stringify(c.options).includes("OWNER")));
    await assert.rejects(readP4V1CiAuthorizedApp(f.prisma,scope,"teams",CI),
      P4V1CiAppDeniedError);
  });
  it("denies active grant without role permission or a permission without entitlement",async()=>{
    for(const settings of [{crmGrant:true,permission:false},{crmGrant:false,permission:true}]){
      const f=fakePrisma(settings);
      await assert.rejects(readP4V1CiAuthorizedApp(f.prisma,
        {organizationId:ORCHID,actorId:ALICE},"crm",CI),P4V1CiAppDeniedError);
      assert.equal(f.reads,0);
    }
  });
  it("rejects foreign/duplicated grants, unapproved permissions and forged role",async()=>{
    for(const tamper of ["duplicate","foreign_app","unknown_permission","bad_role"] as const){
      const f=fakePrisma({tamper});
      await assert.rejects(readP4V1CiAuthorizedApp(f.prisma,
        {organizationId:ORCHID,actorId:ALICE},"crm",CI),P4V1CiAppDeniedError);
      assert.equal(f.reads,0);
    }
  });
  it("denies missing/revoked membership, malformed UUID and invalid app",async()=>{
    for(const member of ["MISSING","REVOKED"] as const){
      const f=fakePrisma({member});
      await assert.rejects(readP4V1CiAuthorizedApp(f.prisma,
        {organizationId:ORCHID,actorId:ALICE},"crm",CI),P4V1CiAppDeniedError);
      assert.equal(f.reads,0);
    }
    const f=fakePrisma();
    await assert.rejects(readP4V1CiAuthorizedApp(f.prisma,
      {organizationId:ORCHID,actorId:"auth0|demo-alice"},"crm",CI),P4V1CiAppDeniedError);
    await assert.rejects(readP4V1CiAuthorizedApp(f.prisma,
      {organizationId:ORCHID,actorId:ALICE},"finance",CI),P4V1CiAppDeniedError);
    assert.equal(f.reads,0);
  });
});


describe("P4.13 direct lead record and field authorization",()=>{
  const scope={organizationId:ORCHID,actorId:ALICE};
  const ownRecord="40000000-0000-4000-8000-000000000001";
  it("requires exact tenant+record key and returns only allowlisted fields",async()=>{
    const f=fakePrisma();
    const result=await readP4V1CiAuthorizedLead(f.prisma,scope,ownRecord,CI);
    assert.deepEqual(result,{
      organizationId:ORCHID,id:ownRecord,label:"Demo Orchid Lead",
    });
    assert.equal(JSON.stringify(result).includes("PRIVATE"),false);
    assert.equal(f.reads,1);
    assert.ok(f.calls.some(c=>c.model==="record" &&
      JSON.stringify(c.options).includes(ORCHID) &&
      JSON.stringify(c.options).includes(ownRecord)));
  });
  it("denies invalid, missing and RLS-filtered foreign records",async()=>{
    const f=fakePrisma();
    await assert.rejects(readP4V1CiAuthorizedLead(f.prisma,scope,
      "not-a-uuid",CI),P4V1CiAppDeniedError);
    assert.equal(f.reads,0);
    for(const config of [{recordMissing:true},{recordForeign:true}]){
      const fake=fakePrisma(config);
      await assert.rejects(readP4V1CiAuthorizedLead(fake.prisma,scope,
        ownRecord,CI),P4V1CiAppDeniedError);
    }
  });
  it("never queries a lead when app grant or role permission is absent",async()=>{
    for(const config of [{crmGrant:false},{permission:false},
      {member:"REVOKED" as const},{member:"MISSING" as const}]){
      const fake=fakePrisma(config);
      await assert.rejects(readP4V1CiAuthorizedLead(fake.prisma,scope,
        ownRecord,CI),P4V1CiAppDeniedError);
      assert.equal(fake.reads,0);
    }
  });
});

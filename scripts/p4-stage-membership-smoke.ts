import assert from "node:assert/strict";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../backend/src/generated/p4-stage/client.js";
import { PrismaStageMembershipReader } from "../backend/src/platform/staging-membership-db.js";
import { assertP4V1CiPrismaEnvironment } from "../backend/src/platform/p4-v1-ci-prisma.js";
const orgA="97000000-0000-4000-8000-000000000001",orgB="97000000-0000-4000-8000-000000000002";
const userA="97000000-0000-4000-8000-000000000003",userB="97000000-0000-4000-8000-000000000004";
const issuer="https://fixture.us.auth0.com/",id={issuer,subject:"auth0|fixture-user-a"};
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const common={host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",password:"fake_ci_not_for_real_accounts",max:1,connectionTimeoutMillis:3000};
 const admin=new pg.Pool({...common,user:"demo_ci"});
 const db=new PrismaClient({adapter:new PrismaPg({...common,user:"p4_stage_runtime"})});
 const reader=new PrismaStageMembershipReader(db,"zoho_clone_synthetic_ci");
 try {
  await admin.query("INSERT INTO platform_stage.users(id) VALUES($1),($2)",[userA,userB]);
  await admin.query("INSERT INTO platform_stage.organizations(id) VALUES($1),($2)",[orgA,orgB]);
  await admin.query("INSERT INTO platform_stage.identity_subjects(issuer,subject,user_id,verified) VALUES($1,$2,$3,true),($1,$4,$5,true)",[issuer,id.subject,userA,"auth0|fixture-user-b",userB]);
  await admin.query("INSERT INTO platform_stage.memberships(organization_id,user_id,role) VALUES($1,$2,'OWNER'),($3,$4,'MEMBER')",[orgA,userA,orgB,userB]);
  assert.deepEqual(await reader.read(id,orgA),{actorId:userA,organizationId:orgA,role:"OWNER"});
  assert.equal(await reader.read(id,orgB),null);
  assert.deepEqual(await reader.read({issuer,subject:"auth0|fixture-user-b"},orgB),{actorId:userB,organizationId:orgB,role:"MEMBER"});
  assert.equal(await reader.read({...id,issuer:"https://other.auth0.com/"},orgA),null);
  await assert.rejects(db.$queryRaw`SELECT * FROM platform_stage.memberships`);
  await assert.rejects(db.$executeRaw`UPDATE platform_stage.memberships SET active=false`);
  await admin.query("UPDATE platform_stage.identity_subjects SET verified=false WHERE user_id=$1",[userA]);
  assert.equal(await reader.read(id,orgA),null);
  await admin.query("UPDATE platform_stage.identity_subjects SET verified=true WHERE user_id=$1",[userA]);
  await admin.query("UPDATE platform_stage.memberships SET active=false,revision=revision+1 WHERE user_id=$1",[userA]);
  assert.equal(await reader.read(id,orgA),null);
  assert.equal(await reader.read(id,orgB),null);
  await admin.query("GRANT SELECT(id) ON platform_stage.users TO p4_stage_runtime");
  try {await assert.rejects(reader.read(id,orgA),/P4_STAGE_MEMBERSHIP_UNAVAILABLE/);}
  finally {await admin.query("REVOKE SELECT(id) ON platform_stage.users FROM p4_stage_runtime");}
  console.log("P4 staging membership: restricted Prisma, tenant separation, revoked identity/membership and privilege drift PASS; NO_GO");
 }finally{await db.$disconnect();await admin.end();}
}
main().catch(()=>{console.error("P4_STAGE_MEMBERSHIP_SMOKE_FAILED");process.exitCode=1;});

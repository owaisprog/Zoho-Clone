import assert from "node:assert/strict";
import { describe,it } from "node:test";
import {
  reviewP4R10CiChange,
  mayDeactivateOwnerMembership,
  type P4R10CiChange, type P4R10CiSnapshot,
} from "../src/platform/p4-r10-ci-change-policy.js";

const O="20000000-0000-4000-8000-000000000001";
const OTHER="20000000-0000-4000-8000-000000000002";
const OWNER="10000000-0000-4000-8000-0000000000a1";
const MEMBER="10000000-0000-4000-8000-0000000000c1";
const TEAM="30000000-0000-4000-8000-000000000001";
const ID="90000000-0000-4000-8000-000000000001";
function command(p:Partial<P4R10CiChange>={}):P4R10CiChange {
  return {requestId:ID,organizationId:O,actorId:OWNER,targetUserId:MEMBER,
    kind:"role_grant",targetRef:"SALES_REP",expectedActive:true,
    nextActive:false,expectedRevision:6,...p};
}
function snapshot(p:Partial<P4R10CiSnapshot>={}):P4R10CiSnapshot {
  return {serverResolved:true,verifiedIdentity:true,activeOrganization:true,
    actorActiveMembership:true,targetActiveMembership:true,
    organizationId:O,actorId:OWNER,targetUserId:MEMBER,
    actorRoles:["ORG_OWNER"],targetRoles:["SALES_REP"],
    currentRevision:6,currentActive:true,activeOwnerCount:1,
    currentTargetTeam:{organizationId:O,teamId:TEAM,userId:MEMBER,managed:false},
    ...p,
  };
}
describe("P4 Batch 10 decision-only P1.06 role/team changes",()=>{
  it("generates a minimal audit proposal for an existing sales role toggle, no write",()=>{
    const result=reviewP4R10CiChange(command(),snapshot());
    assert.equal(result.status,"proposed");
    assert.deepEqual(result.audit,{
      organizationId:O,actorId:OWNER,targetUserId:MEMBER,kind:"role_grant",
      targetRef:"SALES_REP",requestId:ID,beforeActive:true,afterActive:false,
      expectedRevision:6,
    });
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.audit));
  });
  it("allows a preexisting team grant deactivation but not managed flag elevation",()=>{
    assert.equal(reviewP4R10CiChange(command({
      kind:"team_grant",targetRef:TEAM,
    }),snapshot()).status,"proposed");
    assert.equal(reviewP4R10CiChange(command({
      kind:"team_grant",targetRef:TEAM,
    }),snapshot({
      currentTargetTeam:{organizationId:O,teamId:TEAM,userId:MEMBER,managed:true},
    })).status,"denied");
  });
  it("denies unknown role, reserved roles, admin/security/support self escalation",()=>{
    for(const targetRef of ["ORG_OWNER","ORG_ADMIN","SECURITY_REVIEWER",
      "SYSTEM_WORKER","PLATFORM_SUPPORT","BILLING_ADMIN","SALES_DIRECTOR"]){
      assert.equal(reviewP4R10CiChange(command({targetRef}),snapshot()).status,
        "denied");
    }
    for(const actorRoles of [["ORG_ADMIN"],["SALES_MANAGER"],
      ["PLATFORM_SUPPORT"],["ORG_OWNER","PLATFORM_SUPPORT"],
      ["ORG_OWNER","ORG_ADMIN"]]){
      assert.equal(reviewP4R10CiChange(command(),snapshot({actorRoles})).status,
        "denied");
    }
  });
  it("never assumes server evidence, current membership, org or token is verified",()=>{
    for(const changed of [
      {verifiedIdentity:false},{serverResolved:false},{activeOrganization:false},
      {actorActiveMembership:false},{targetActiveMembership:false},
      {organizationId:OTHER},{actorId:MEMBER},{targetUserId:OWNER},
      {actorRoles:["ORG_OWNER","ORG_OWNER"]},
      {targetRoles:["SYSTEM_WORKER"]},
      {activeOwnerCount:0},
    ]){
      assert.equal(reviewP4R10CiChange(command(),snapshot(
        changed as Partial<P4R10CiSnapshot>,
      )).status,"denied");
    }
  });
  it("denies cross-tenant request, self-changes, malformed IDs, no-op and role forgery",()=>{
    for(const changed of [
      {organizationId:OTHER},{actorId:MEMBER},{targetUserId:OWNER},
      {requestId:"not-a-uuid"},
      {requestId:"90000000-0000-1000-8000-000000000001"},
      {expectedActive:false,nextActive:false},{kind:"app_grant" as never},
      {targetRef:"very-long-".repeat(20)},
      {expectedRevision:-1},
    ]){
      assert.equal(reviewP4R10CiChange(command(changed),snapshot()).status,"denied");
    }
  });
  it("returns a conflict, never a successful audit, on stale revisions or old state",()=>{
    for(const changed of [
      {currentRevision:7},{currentActive:false},
    ]){
      const x=reviewP4R10CiChange(command(),snapshot(changed));
      assert.equal(x.status,"conflict");
      assert.equal(x.audit,undefined);
    }
  });
  it("fails closed for foreign, missing, unexpected or managed team grants",()=>{
    const changes=[
      {organizationId:OTHER,teamId:TEAM,userId:MEMBER,managed:false},
      {organizationId:O,teamId:TEAM,userId:OWNER,managed:false},
      {organizationId:O,teamId:TEAM,userId:MEMBER,managed:true},
    ];
    for(const currentTargetTeam of changes){
      assert.equal(reviewP4R10CiChange(command({
        kind:"team_grant",targetRef:TEAM,
      }),snapshot({currentTargetTeam})).status,"denied");
    }
    assert.equal(reviewP4R10CiChange(command({
      kind:"team_grant",targetRef:TEAM,
    }),snapshot({currentTargetTeam:undefined})).status,"denied");
  });
  it("cannot deactivate a last owner or bypass protected transfer with a fake replacement",()=>{
    assert.equal(mayDeactivateOwnerMembership(1,false),false);
    assert.equal(mayDeactivateOwnerMembership(1,true),false);
    assert.equal(mayDeactivateOwnerMembership(2,true),false);
    assert.equal(mayDeactivateOwnerMembership(999,true),false);
    assert.equal(mayDeactivateOwnerMembership(undefined,true),false);
  });
});

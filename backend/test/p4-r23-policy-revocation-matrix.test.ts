import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {P4_R7_P106_POLICY_ROWS,P4_R7_P106_ROLES,
 P4_R7_P106_RESOURCES,P4_R7_P106_ROW_COUNT}
 from "../src/platform/p4-r7-approved-policy-matrix.js";
import {getP4R7ApprovedMatrixRow,authorizeP4R7Synthetic,
 type P4R7Evidence} from "../src/platform/p4-r7-authorizer.js";
const ORG="20000000-0000-4000-8000-000000000001";
const ACTOR="10000000-0000-4000-8000-0000000000a1";
const E:P4R7Evidence={serverResolved:true,verifiedIdentity:true,
 activeMembership:true,organizationActive:true,organizationId:ORG,
 actorId:ACTOR,roleCodes:["ORG_OWNER"],enabledApps:["platform","crm"],
 activeTeamGrants:[]};
describe("P4 R23 matrix-bound access and revocation proof",()=>{
 it("preserves 13 by 22 owner-approved design rows with unique pairs",()=>{
  assert.equal(P4_R7_P106_POLICY_ROWS.length,P4_R7_P106_ROW_COUNT);
  assert.equal(P4_R7_P106_ROLES.length,13);
  assert.equal(P4_R7_P106_RESOURCES.length,22);
  const pairs=new Set(P4_R7_P106_POLICY_ROWS.map(r=>r.role+"|"+r.resource));
  assert.equal(pairs.size,286);
  for(const role of P4_R7_P106_ROLES)
   for(const resource of P4_R7_P106_RESOURCES)
    assert.ok(pairs.has(role+"|"+resource));
 });
 it("unknown role, resource and undocumented action never gain a matrix row",()=>{
  for(const x of ["OWNER","admin","ORG_OWNER ","__proto__",null]){
   assert.equal(getP4R7ApprovedMatrixRow(x,"organization"),null);
  }
  for(const resource of ["tenants","hidden_config","__proto__",null]){
   assert.equal(getP4R7ApprovedMatrixRow("ORG_OWNER",resource),null);
  }
 });
 it("owner can read only scoped organizational metadata, never implicit CRM",()=>{
  assert.equal(authorizeP4R7Synthetic(E,"organization","R",undefined,
   ["id","displayName"]).allowed,true);
  assert.equal(authorizeP4R7Synthetic(E,"leads","R",undefined,
   ["id","displayName"]).allowed,false);
  assert.equal(authorizeP4R7Synthetic(E,"organization","R",undefined,
   ["id","billing_secret"]).allowed,false);
 });
 it("revoke membership immediately denies owner organization read",()=>{
  const revoked={...E,activeMembership:false};
  assert.equal(authorizeP4R7Synthetic(revoked as P4R7Evidence,
   "organization","R",undefined,["id"]).allowed,false);
 });
 it("disabled platform entitlement denies org and audit even with owner role",()=>{
  const revoked={...E,enabledApps:["crm"]};
  for(const resource of ["organization","audit_events"]){
   assert.equal(authorizeP4R7Synthetic(revoked,resource,"R",undefined,
    ["id"]).allowed,false);
  }
 });
 it("no verified identity or trusted server evidence means default deny",()=>{
  for(const patch of [{verifiedIdentity:false},{serverResolved:false},
   {organizationActive:false}]){
   assert.equal(authorizeP4R7Synthetic({...E,...patch} as P4R7Evidence,
    "organization","R",undefined,["id"]).allowed,false);
  }
 });
 it("sales role cannot read organization, owner cannot write or elevate",()=>{
  const sales={...E,roleCodes:["SALES_REP"] as const};
  assert.equal(authorizeP4R7Synthetic(sales,"organization","R",undefined,
    ["id"]).allowed,false);
  for(const action of ["C","U","M","E"]){
   assert.equal(authorizeP4R7Synthetic(E,"organization",action,undefined,
    ["id"]).allowed,false);
  }
 });
 it("reviewer read scope remains strictly safe and read-only",()=>{
  const reviewer={...E,roleCodes:["SECURITY_REVIEWER"] as const};
  assert.equal(authorizeP4R7Synthetic(reviewer,"organization","R",undefined,
    ["id"]).allowed,true);
  assert.equal(authorizeP4R7Synthetic(reviewer,"organization","R",undefined,
    ["id","displayName"]).allowed,true);
  assert.equal(authorizeP4R7Synthetic(reviewer,"organization","M",undefined,
    ["id"]).allowed,false);
 });
 it("duplicate role claims and forged tenant metadata are always denied",()=>{
  const duplicate={...E,roleCodes:["ORG_OWNER","ORG_OWNER"] as const};
  assert.equal(authorizeP4R7Synthetic(duplicate,"organization","R",undefined,
    ["id"]).allowed,false);
  const invalid={...E,organizationId:"not-a-uuid"};
  assert.equal(authorizeP4R7Synthetic(invalid,"organization","R",undefined,
    ["id"]).allowed,false);
 });
});

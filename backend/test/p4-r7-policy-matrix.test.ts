import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  P4_R7_P106_POLICY_ROWS,
  P4_R7_P106_ROW_COUNT,
  P4_R7_P106_RESOURCES,
  P4_R7_P106_ROLES,
} from "../src/platform/p4-r7-approved-policy-matrix.js";
import {
  authorizeP4R7Synthetic,
  getP4R7ApprovedMatrixRow,
  projectP4R7SyntheticLead,
  P4R7PolicyDeniedError,
  type P4R7Evidence,
  type P4R7Record,
} from "../src/platform/p4-r7-authorizer.js";

const org="20000000-0000-4000-8000-000000000001";
const foreign="20000000-0000-4000-8000-000000000002";
const alice="10000000-0000-4000-8000-0000000000a1";
const manager="10000000-0000-4000-8000-0000000000d1";
const team="30000000-0000-4000-8000-000000000001";
const lead="40000000-0000-4000-8000-000000000001";

function evidence(overrides: Record<string,unknown> = {}): P4R7Evidence {
  return {
    serverResolved:true,verifiedIdentity:true,activeMembership:true,
    organizationActive:true,organizationId:org,actorId:alice,
    roleCodes:["SALES_REP"],enabledApps:["crm","platform"],
    activeTeamGrants:[{organizationId:org,userId:alice,teamId:team,
      active:true,managed:false}],
    ...overrides,
  } as P4R7Evidence;
}
function record(overrides: Record<string,unknown> = {}): P4R7Record {
  return {
    organizationId:org,id:lead,ownerUserId:manager,teamId:team,
    shareState:"private",assignedUserIds:[],
    ...overrides,
  } as P4R7Record;
}
const fields=["id","displayName"];

describe("P1.06 design has EXACT 286-role/resource decisions",()=>{
  it("matches existing approved source rows and all 13 roles/22 resource families",()=>{
    const csv=readFileSync(new URL("../../docs/security/permission-matrix.csv",import.meta.url),"utf8");
    const lines=csv.trimEnd().split(/\r?\n/);
    assert.equal(lines.length,287);
    const parse=(line:string)=>[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)]
      .map(m=>(m[1]??"").replace(/""/g,'"'));
    const source=lines.slice(1).map(parse);
    assert.equal(P4_R7_P106_ROW_COUNT,286);
    assert.equal(P4_R7_P106_POLICY_ROWS.length,286);
    assert.equal(P4_R7_P106_ROLES.length,13);
    assert.equal(P4_R7_P106_RESOURCES.length,22);
    const keys=new Set<string>();
    for(let i=0;i<source.length;i++){
      const raw=source[i]!;
      const row=P4_R7_P106_POLICY_ROWS[i]!;
      assert.equal(raw.length,10);
      assert.deepEqual({
        resource:row.resource,release:row.release,role:row.role,
        actions:row.actions,rowScope:row.rowScope,fieldScope:row.fieldScope,
        conditions:row.conditions,
      },{
        resource:raw[0],release:raw[1],role:raw[3],
        actions:raw[4]==="NONE"?[]:raw[4]!.split(","),
        rowScope:raw[5],fieldScope:raw[6],conditions:raw[7],
      });
      assert.equal(raw[9],"DESIGN_ONLY_NOT_IMPLEMENTED");
      const k=row.role+"|"+row.resource;
      assert.equal(keys.has(k),false);
      keys.add(k);
    }
    assert.equal(keys.size,13*22);
  });
  it("preserves deliberate ORG_OWNER/ORG_ADMIN CRM denies and distinct export action",()=>{
    for(const role of ["ORG_OWNER","ORG_ADMIN","PLATFORM_SUPPORT","EXTERNAL_AGENT","SYSTEM_WORKER"]){
      assert.deepEqual(getP4R7ApprovedMatrixRow(role,"leads")?.actions,[]);
    }
    assert.deepEqual(getP4R7ApprovedMatrixRow("SALES_REP","leads")?.actions,["C","R","U"]);
    assert.deepEqual(getP4R7ApprovedMatrixRow("SALES_MANAGER","leads")?.actions,["C","R","U"]);
    assert.equal(getP4R7ApprovedMatrixRow("ORG_OWNER","audit_events")?.actions[0],"R");
    assert.equal(getP4R7ApprovedMatrixRow("SECURITY_REVIEWER","audit_events")?.actions[0],"R");
    assert.equal(getP4R7ApprovedMatrixRow("PLATFORM_SUPPORT","organization")?.actions.length,0);
  });
});
describe("P4 Batch 7 verified synthetic RBAC + record-sharing ABAC",()=>{
  it("denies by default without fresh verified evidence, tenant, entitlement, or allowed role",()=>{
    for(const bad of [
      null,evidence({verifiedIdentity:false}),evidence({activeMembership:false}),
      evidence({organizationActive:false}),evidence({serverResolved:false}),
      evidence({organizationId:foreign}),evidence({actorId:"auth0|demo"}),
      evidence({roleCodes:["ORG_OWNER"]}),evidence({roleCodes:["ORG_ADMIN"]}),
      evidence({roleCodes:["PLATFORM_SUPPORT"]}),evidence({roleCodes:["EXTERNAL_MERCHANT"]}),
      evidence({roleCodes:["SYSTEM_WORKER"]}),evidence({roleCodes:["GOD"]}),
      evidence({enabledApps:["platform"]}),evidence({roleCodes:[]}),
    ]){
      assert.equal(authorizeP4R7Synthetic(bad,"leads","R",
        record({ownerUserId:alice}),fields).allowed,false);
    }
  });
  it("allows a sales rep to read owned records, not a stranger's private lead",()=>{
    assert.equal(authorizeP4R7Synthetic(evidence(),"leads","R",
      record({ownerUserId:alice}),fields).allowed,true);
    assert.equal(authorizeP4R7Synthetic(evidence(),"leads","R",record(),fields).allowed,false);
    assert.equal(authorizeP4R7Synthetic(evidence(),"leads","R",
      record({ownerUserId:manager,assignedUserIds:[alice]}),fields).allowed,true);
  });
  it("does not convert team membership into automatic access to private records",()=>{
    assert.equal(authorizeP4R7Synthetic(evidence(),"leads","R",
      record({shareState:"private"}),fields).allowed,false);
    assert.equal(authorizeP4R7Synthetic(evidence(),"leads","R",
      record({shareState:"explicit_team"}),fields).allowed,true);
    assert.equal(authorizeP4R7Synthetic(evidence({activeTeamGrants:[]}),"leads","R",
      record({shareState:"explicit_team"}),fields).allowed,false);
  });
  it("requires explicit managed team scope for SALES_MANAGER, not an arbitrary manager title",()=>{
    const salesManager=evidence({roleCodes:["SALES_MANAGER"],activeTeamGrants:[
      {organizationId:org,userId:alice,teamId:team,active:true,managed:false},
    ]});
    const lead=record({shareState:"explicit_team"});
    assert.equal(authorizeP4R7Synthetic(salesManager,"leads","R",lead,fields).allowed,false);
    const assigned=evidence({roleCodes:["SALES_MANAGER"],activeTeamGrants:[
      {organizationId:org,userId:alice,teamId:team,active:true,managed:true},
    ]});
    assert.equal(authorizeP4R7Synthetic(assigned,"leads","R",lead,fields).allowed,true);
  });
  it("intersects multiple role action grants with record/field/tenant limits",()=>{
    const multiple=evidence({roleCodes:["ORG_OWNER","SALES_REP"]});
    assert.equal(authorizeP4R7Synthetic(multiple,"leads","R",
      record({ownerUserId:alice}),fields).allowed,true);
    assert.equal(authorizeP4R7Synthetic(multiple,"leads","R",record(),fields).allowed,false);
    assert.equal(authorizeP4R7Synthetic(multiple,"leads","R",
      record({organizationId:foreign,ownerUserId:alice}),fields).allowed,false);
  });
  it("forbids unknown fields, duplicates, private notes, export, mutation and hard-delete",()=>{
    for(const requested of [
      ["id","confidentialNote"],["id","private_object_locator"],
      ["id","email"],["id","id"],[],["id",42] as unknown as string[],
    ]){
      assert.equal(authorizeP4R7Synthetic(evidence(),"leads","R",
        record({ownerUserId:alice}),requested).allowed,false);
    }
    for(const action of ["C","U","E","M","D","admin"]){
      assert.equal(authorizeP4R7Synthetic(evidence(),"leads",action,
        record({ownerUserId:alice}),fields).allowed,false);
    }
  });
  it("does not enable other 19 resource families just because P1.06 allows their design",()=>{
    for(const resource of P4_R7_P106_RESOURCES){
      if(["leads","organization","audit_events"].includes(resource))continue;
      assert.equal(authorizeP4R7Synthetic(evidence({
        roleCodes:["ORG_OWNER","SALES_REP","SALES_MANAGER"],
      }),resource,"R",undefined,fields).allowed,false);
    }
  });
  it("allows sanitized audit metadata only for the P1.06 reviewer roles",()=>{
    for(const role of ["ORG_OWNER","SECURITY_REVIEWER"]){
      const d=authorizeP4R7Synthetic(evidence({
        roleCodes:[role],enabledApps:["platform"],
      }),"audit_events","R",undefined,["id","action","occurredAt"]);
      assert.equal(d.allowed,true);
    }
    assert.equal(authorizeP4R7Synthetic(evidence({
      roleCodes:["ORG_ADMIN"],enabledApps:["platform"],
    }),"audit_events","R",undefined,["id","action","occurredAt"]).allowed,false);
  });
  it("projects only safe fictional lead fields, even if input has secret properties",()=>{
    const d=authorizeP4R7Synthetic(evidence(),"leads","R",
      record({ownerUserId:alice}),fields);
    const v=projectP4R7SyntheticLead(d,{
      id:lead,displayName:"Demo Orchid Lead",
      confidentialNote:"Demo PRIVATE SECRET",email:"private@example.com",
      private_object_locator:"secret-file",
    });
    assert.deepEqual(v,{id:lead,displayName:"Demo Orchid Lead"});
    assert.equal(JSON.stringify(v).includes("PRIVATE"),false);
    assert.ok(Object.isFrozen(v));
    assert.throws(()=>projectP4R7SyntheticLead({
      allowed:false,reason:"denied",fields:[],
    },{id:lead,displayName:"Demo Orchid Lead"}),P4R7PolicyDeniedError);
  });
  it("denies stale or foreign team grants, malformed records and duplicate scopes",()=>{
    for(const bad of [
      evidence({activeTeamGrants:[{organizationId:foreign,teamId:team,
        userId:alice,active:true,managed:true}]}),
      evidence({activeTeamGrants:[{organizationId:org,teamId:team,
        userId:manager,active:true,managed:true}]}),
      evidence({activeTeamGrants:[{organizationId:org,teamId:team,
        userId:alice,active:false,managed:true}]}),
      evidence({roleCodes:["SALES_REP","SALES_REP"]}),
    ]){
      assert.equal(authorizeP4R7Synthetic(bad,"leads","R",
        record({ownerUserId:alice}),fields).allowed,false);
    }
    assert.equal(authorizeP4R7Synthetic(evidence(),"leads","R",
      record({teamId:"team-demo"}),fields).allowed,false);
  });
});

import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {
  P4R12PreviewDenied,previewP4R12Teams,previewP4R12Invites,reviewP4R12InviteAction,
  type P4R12Actor,type P4R12Team,type P4R12Invite,
} from "../src/platform/p4-r12-team-invite-preview.js";
const ORG="20000000-0000-4000-8000-000000000001";
const FOREIGN="20000000-0000-4000-8000-000000000002";
const OWNER="10000000-0000-4000-8000-0000000000a1";
const MANAGER="10000000-0000-4000-8000-0000000000b1";
const MEMBER="10000000-0000-4000-8000-0000000000c1";
const TEAM="30000000-0000-4000-8000-000000000001";
const INVITE="60000000-0000-4000-8000-000000000001";
const actor:P4R12Actor={organizationId:ORG,actorId:OWNER,active:true,platformEnabled:true,
  roles:["ORG_OWNER"],revision:1};
const team:P4R12Team={id:TEAM,organizationId:ORG,name:"Fictional sales team",
  managerIds:[MANAGER],memberIds:[MANAGER,MEMBER],active:true};
const invite:P4R12Invite={id:INVITE,organizationId:ORG,roleCode:"SALES_REP",
  status:"pending",createdAt:"2026-11-20T00:00:00.000Z",
  expiresAt:"2026-11-25T00:00:00.000Z",revision:3};
const now="2026-11-21T00:00:00.000Z";
describe("P4 batch 12: synthetic-only team/invite preflight",()=>{
  it("provides fixed, frozen fields without membership IDs",()=>{
    const out=previewP4R12Teams(actor,[team]);
    assert.deepEqual(out,[{id:TEAM,name:"Fictional sales team",memberCount:2,isManager:false}]);
    assert.equal(JSON.stringify(out).includes(MEMBER),false);
    assert.equal(Object.isFrozen(out),true);
  });
  it("allows a manager to see only their managed active teams",()=>{
    const manager={...actor,actorId:MANAGER,roles:["SALES_MANAGER"] as const};
    const hidden={...team,id:"30000000-0000-4000-8000-000000000002",managerIds:[MEMBER]};
    assert.deepEqual(previewP4R12Teams(manager,[hidden,team]).map(v=>v.id),[TEAM]);
    assert.deepEqual(previewP4R12Teams(manager,[{...team,active:false}]),[]);
  });
  it("denies a sales rep's team directory and rejects cross-tenant rows",()=>{
    assert.throws(()=>previewP4R12Teams({...actor,roles:["SALES_REP"]},[team]),P4R12PreviewDenied);
    assert.throws(()=>previewP4R12Teams(actor,[{...team,organizationId:FOREIGN}]),P4R12PreviewDenied);
  });
  it("denies revoked identities, disabled platform and unknown/duplicate roles",()=>{
    for(const override of [{active:false},{platformEnabled:false},{roles:["FAKE_ROOT"]},
      {roles:["ORG_OWNER","ORG_OWNER"]}]){
      assert.throws(()=>previewP4R12Teams({...actor,...override} as P4R12Actor,[team]),
        P4R12PreviewDenied);
    }
  });
  it("rejects bad team rows and over-limit results, rather than silently truncating",()=>{
    for(const changed of [
      {...team,managerIds:[OWNER]},
      {...team,memberIds:[MANAGER,MANAGER]},
      {...team,name:""},
      {...team,memberIds:["invalid"]},
    ])assert.throws(()=>previewP4R12Teams(actor,[changed]),P4R12PreviewDenied);
    assert.throws(()=>previewP4R12Teams(actor,[team,team]),P4R12PreviewDenied);
    assert.throws(()=>previewP4R12Teams(actor,[team],0),P4R12PreviewDenied);
  });
  it("shows limited invite metadata and calculated expiration with no tokens/emails",()=>{
    const pending=previewP4R12Invites(actor,[invite],now);
    assert.deepEqual(pending,[{id:INVITE,roleCode:"SALES_REP",status:"pending",
      expiresAt:invite.expiresAt,revision:3}]);
    assert.equal(Object.isFrozen(pending[0]),true);
    assert.equal(previewP4R12Invites(actor,[invite],"2026-11-25T00:00:00.000Z")[0]?.status,"expired");
  });
  it("denies reviewer/rep invitation visibility and foreign organization rows",()=>{
    for(const roles of [["SALES_REP"],["SECURITY_REVIEWER"]]){
      assert.throws(()=>previewP4R12Invites({...actor,roles:roles as P4R12Actor["roles"]},[invite],now),
        P4R12PreviewDenied);
    }
    assert.throws(()=>previewP4R12Invites(actor,[{...invite,organizationId:FOREIGN}],now),
      P4R12PreviewDenied);
  });
  it("rejects impossible accepted/revoked history and malformed timestamps",()=>{
    for(const changed of [
      {...invite,status:"accepted" as const},
      {...invite,status:"revoked" as const},
      {...invite,acceptedAt:"2026-11-21T00:00:00.000Z"},
      {...invite,expiresAt:"2026-11-19T00:00:00.000Z"},
      {...invite,createdAt:"not-a-date"},
    ])assert.throws(()=>previewP4R12Invites(actor,[changed],now),P4R12PreviewDenied);
  });
  it("never approves resend, revoke or accept, even for a current owner",()=>{
    for(const action of ["resend","revoke","accept"] as const)
      assert.deepEqual(reviewP4R12InviteAction(actor,invite,action,3,now),
        {allowed:false,reason:"execution-not-approved"});
  });
  it("denies unauthorized action and reports stale/expired/non-pending deterministically",()=>{
    assert.throws(()=>reviewP4R12InviteAction({...actor,roles:["SALES_REP"]},
      invite,"revoke",3,now),P4R12PreviewDenied);
    assert.deepEqual(reviewP4R12InviteAction(actor,invite,"revoke",2,now),
      {allowed:false,reason:"stale"});
    assert.deepEqual(reviewP4R12InviteAction(actor,invite,"revoke",3,invite.expiresAt),
      {allowed:false,reason:"expired"});
    assert.deepEqual(reviewP4R12InviteAction(actor,{...invite,status:"expired"},"revoke",3,now),
      {allowed:false,reason:"not-pending"});
  });
});

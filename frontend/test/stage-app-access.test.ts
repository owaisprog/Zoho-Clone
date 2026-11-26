import {test} from "node:test";
import assert from "node:assert/strict";
import {parseAppNavigation,parseLeadPage} from "../src/lib/stage-app-access";
const id="99110000-0000-4000-8000-000000000001";
const wrap=(data:unknown)=>({scope:"disposable-app-read",data,applicationAccess:false});
test("app navigation and lead projection deny scope escalation and malformed data",()=>{
 assert.equal(parseAppNavigation(wrap({organizationId:id,membershipRole:"OWNER",crmAvailable:false}),id).crmAvailable,false);
 assert.throws(()=>parseAppNavigation(wrap({organizationId:"other",membershipRole:"MEMBER",crmAvailable:true}),id));
 const page={items:[{id,label:"Demo Lead"}],nextCursor:null};
 assert.deepEqual(parseLeadPage(wrap(page),null),page);
 assert.throws(()=>parseLeadPage(wrap({...page,items:[{id,label:"Demo Lead",privateNote:"fixture"}]}),null));
 assert.throws(()=>parseLeadPage({...wrap(page),applicationAccess:true},null));
});

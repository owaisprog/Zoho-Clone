import {test} from "node:test";
import assert from "node:assert/strict";
import {CiStageAppAccess,parseAppProjection} from "../src/platform/p4-ci-stage-app-access.js";
const id="99110000-0000-4000-8000-000000000001";
test("application access stays disposable and rejects extra projection fields",()=>{
 assert.throws(()=>new CiStageAppAccess({}));
 assert.deepEqual(parseAppProjection([{id,label:"Demo Lead"}],"leads",id,null,null),{items:[{id,label:"Demo Lead"}],nextCursor:null});
 for(const x of [[{id,label:"Demo Lead",privateNote:"fake"}],[{id,label:"Not fixture"}],[{id,label:"Demo Lead"},{id,label:"Demo Lead"}]])assert.throws(()=>parseAppProjection(x,"leads",id,null,null));
 assert.throws(()=>parseAppProjection(null,"lead",id,null,id));
});

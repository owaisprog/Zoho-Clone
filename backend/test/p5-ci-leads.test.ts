import {test} from "node:test";
import assert from "node:assert/strict";
import {CiP5Leads,parseCreateLead,parseLead,parseChangeLead,parseLeadFilter,parseHistory} from "../src/platform/p5-ci-leads.js";
const id="99300000-0000-4000-8000-000000000001";
const good={id,requestId:id,companyName:"Demo Company",contactEmail:"sample@example.com",source:"WEBSITE"};
test("P5 create validates synthetic fields, refuses unknown and sensitive attributes",()=>{
 assert.deepEqual(parseCreateLead(good),good);
 for(const x of [{...good,cardNumber:"fake"},{...good,ownerId:id},{...good,contactEmail:"sample@real.invalid"},{...good,companyName:"Real Company"},{...good,id:"wrong"}])assert.throws(()=>parseCreateLead(x));
 assert.throws(()=>new CiP5Leads({}));
});
test("P5 lead projection strictly redacts internal metadata",()=>{
 const {requestId:_,...base}=good;const row={...base,status:"NEW",revision:0};
 assert.deepEqual(parseLead(row),row);assert.throws(()=>parseLead({...row,actorId:id}));assert.throws(()=>parseLead({...row,revision:-1}));
});

test("lead edits are revision-bound and stage transitions have a separate command",()=>{
 const cmd={operation:"transition",requestId:id,expectedRevision:2,nextStatus:"CONTACTED"};
 assert.deepEqual(parseChangeLead(cmd),cmd);
 for(const x of [{...cmd,nextStatus:"NEW"},{...cmd,expectedRevision:-1},{...cmd,ownerId:id},{...cmd,source:"EVENT"}])assert.throws(()=>parseChangeLead(x));
 assert.deepEqual(parseLeadFilter({search:"Demo",source:"EVENT",status:"NEW"}),{search:"Demo",source:"EVENT",status:"NEW"});
 assert.throws(()=>parseLeadFilter({search:"%",source:null,status:null}));
 assert.throws(()=>parseHistory([{action:"STAGE_CHANGED",revision:1,previousStatus:"NEW",nextStatus:"LOST"}],-1));
});

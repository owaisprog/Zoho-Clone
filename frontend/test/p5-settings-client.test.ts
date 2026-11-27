import {test} from "node:test";
import assert from "node:assert/strict";
import {parseSettings,parseFields,parseRelations} from "../src/lib/p5-settings-client";
const id="99400000-0000-4000-8000-000000000001",f="99400000-0000-4000-8000-000000000002";
test("configuration rejects mismatched permission flags and malformed custom field values",()=>{
 const s={locale:"en-US",revision:-1,defaultPipelineId:id,permissions:{admin:false,manager:false,custom:true}};
 assert.deepEqual(parseSettings(s),s);assert.throws(()=>parseSettings({...s,permissions:{admin:true,manager:false,custom:true}}));
 const field={id:f,label:"Demo Count",kind:"INTEGER",position:1,value:7,revision:0};
 assert.deepEqual(parseFields({accountId:id,fields:[field]},id),[field]);
 assert.throws(()=>parseFields({accountId:id,fields:[{...field,value:true}]},id));
 assert.throws(()=>parseRelations({id,parentId:id,revision:0,children:[],candidates:[]},id));
});

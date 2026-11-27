import {test} from "node:test";
import assert from "node:assert/strict";
import {parseSearch,parseView} from "../src/lib/p5-search-client";
const id="99400000-0000-4000-8000-000000000001";
test("search and view projections constrain entity, detail and filters",()=>{
 const row={id,kind:"CONTACT",label:"Demo Contact Alpha",detail:"alpha@example.com"};
 assert.deepEqual(parseSearch(row,"ALL"),row);
 assert.throws(()=>parseSearch(row,"DEAL"));
 assert.throws(()=>parseSearch({...row,detail:"alpha@real.com"},"ALL"));
 const v={id,name:"Demo Contact View",query:"Demo Contact",entity:"CONTACT",columnsMode:"COMPACT",revision:0};
 assert.deepEqual(parseView(v),v);assert.throws(()=>parseView({...v,query:"%"}));assert.throws(()=>parseView({...v,actorId:id}));
});

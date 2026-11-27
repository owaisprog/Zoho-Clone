import {test} from "node:test";
import assert from "node:assert/strict";
import {parseDeal,parseDealPage} from "../src/lib/p5-conversion-client";
import {parseDealHistory} from "../src/lib/p5-deals-client";
const id="99400000-0000-4000-8000-000000000001",row={id,accountId:id,contactId:id,title:"Demo Deal",stage:"DISCOVERY",revision:1,valueCents:100};
test("deal projections and history are bounded",()=>{assert.deepEqual(parseDeal(row),row);assert.throws(()=>parseDeal({...row,valueCents:1.5}));assert.throws(()=>parseDealPage({items:[row,row],nextCursor:null},null));assert.throws(()=>parseDealHistory({items:[{action:"STAGE_CHANGED",revision:1,previousStage:"OPEN",nextStage:"OPEN"}],nextCursor:null},-1));});

import {test} from "node:test";
import assert from "node:assert/strict";
import {parseBoard} from "../src/platform/p5-ci-sales-board.js";
const id="99400000-0000-4000-8000-000000000001",row={id,accountId:id,contactId:id,pipelineId:id,title:"Demo Board Deal",stage:"OPEN",revision:0,valueCents:100,nextStages:["LOST","WON"]};
const empty=(key:string)=>({key,label:key,count:0,valueCents:0,items:[],nextCursor:null});
const board={pipelineId:id,pipelineName:"Demo Board",pipelineRevision:0,columns:[{...empty("OPEN"),count:1,valueCents:100,items:[row]},empty("WON"),empty("LOST")]};
test("board parser reconciles displayed totals and scopes",()=>{
 assert.equal(parseBoard(board,id,null,null).columns[0]?.count,1);
 for(const bad of [{...board,pipelineId:"bad"},{...board,columns:[{...board.columns[0],valueCents:1},...board.columns.slice(1)]},{...board,columns:[{...board.columns[0],items:[{...row,stage:"WON"}]},...board.columns.slice(1)]},{...board,columns:[{...board.columns[0],count:2},...board.columns.slice(1)]}])assert.throws(()=>parseBoard(bad,id,null,null));
});

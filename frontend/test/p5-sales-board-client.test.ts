import {test} from "node:test";
import assert from "node:assert/strict";
import {createP5SalesBoardClient,parseBoard} from "../src/lib/p5-sales-board-client";
const id="99400000-0000-4000-8000-000000000001",board={pipelineId:id,pipelineName:"Demo Board",pipelineRevision:0,columns:["OPEN","WON","LOST"].map(key=>({key,label:key,count:0,valueCents:0,items:[],nextCursor:null}))};
test("board client uses same-origin route and rejects foreign or unbounded projections",async()=>{
 const client=createP5SalesBoardClient(async(url,init)=>{assert.equal(String(url),"/api/p5/"+id+"/crm/board?pipelineId="+id+"&search=");assert.equal(init?.credentials,"same-origin");return Response.json({scope:"p5-synthetic",applicationAccess:false,data:board});});
 assert.equal((await client.board(id,id)).columns.length,3);
 assert.throws(()=>parseBoard({...board,columns:[{...board.columns[0],count:1},...board.columns.slice(1)]},id,null,null));await assert.rejects(client.board(id,id,"",null,id));
});

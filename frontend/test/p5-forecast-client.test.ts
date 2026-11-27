import {test} from "node:test";
import assert from "node:assert/strict";
import {parseForecast,parseReport,validRange} from "../src/lib/p5-forecast-client";
const id="99400000-0000-4000-8000-000000000001";
test("forecast inputs and report projections reject invalid bounds and foreign scope",()=>{
 const input={dealId:id,expectedClose:"2027-01-31",probabilityBp:5000,revision:0};
 assert.deepEqual(parseForecast(input,id),input);assert.throws(()=>parseForecast({...input,probabilityBp:10001},id));
 assert.equal(validRange("2027-01-01","2028-12-31"),false);
 const empty={count:0,valueCents:0,missingCount:0,scheduledCount:0,weightedCents:0,closedCount:0,wonCents:0};
 const r={pipelineId:id,from:"2027-01-01",to:"2027-01-31",currency:"USD",stages:[{...empty,key:"OPEN",label:"Open"},{...empty,key:"WON",label:"Won"},{...empty,key:"LOST",label:"Lost"}]};
 assert.deepEqual(parseReport(r,id,r.from,r.to),r);
 assert.throws(()=>parseReport({...r,stages:[{...r.stages[0],weightedCents:1},...r.stages.slice(1)]},id,r.from,r.to));
});

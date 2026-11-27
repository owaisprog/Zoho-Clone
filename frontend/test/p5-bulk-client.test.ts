import {test} from "node:test";
import assert from "node:assert/strict";
import {parseExport,parseBulk,exportCsv} from "../src/lib/p5-bulk-client";
const id="99400000-0000-4000-8000-000000000001",job="99400000-0000-4000-8000-000000000002";
test("export checks authorized selection and renders quoted CSV",()=>{
 const row={id,companyName:"Demo Export Lead",contactEmail:"export@example.com",source:"WEBSITE" as const,status:"NEW" as const,revision:0};
 assert.deepEqual(parseExport({id:job,rows:[row]},job,[id]),{id:job,rows:[row]});
 assert.throws(()=>parseExport({id:job,rows:[row]},job,[job]));
 assert.throws(()=>parseExport({id:job,rows:[row,row]},job));
 assert.match(exportCsv([row]),/"Demo Export Lead","export@example.com"/);
 assert.match(exportCsv([{...row,companyName:"=1+1"}]),/"'=1\+1"/);
 assert.deepEqual(parseBulk({id:job,count:1},job,1),{id:job,count:1});
 assert.throws(()=>parseBulk({id:job,count:2},job,1));
});

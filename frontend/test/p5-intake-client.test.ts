import {test} from "node:test";
import assert from "node:assert/strict";
import {parseIntakeCsv,validIntakeRow} from "../src/lib/p5-intake-csv";
import {parseImport} from "../src/lib/p5-intake-client";
const id="99400000-0000-4000-8000-000000000001";
test("CSV maps reordered headers, isolates malformed rows and rejects unknown headers",()=>{
 const rows=parseIntakeCsv('source,companyName,contactEmail\nEVENT,"Demo Import Lead",one@example.com\nREFERRAL,broken\nWEBSITE,Demo Other Lead,two@example.com');
 assert.deepEqual(rows,[["Demo Import Lead","one@example.com","EVENT"],null,["Demo Other Lead","two@example.com","WEBSITE"]]);
 assert.deepEqual(rows.map(validIntakeRow),[true,false,true]);
 assert.throws(()=>parseIntakeCsv("wrong,source,contactEmail\nA,B,C"));
 assert.equal(validIntakeRow(["Demo Real Lead","someone@real.com","EVENT"]),false);
 assert.throws(()=>parseImport({id,rows:[{row:1,outcome:"INVALID",leadId:id}]},id));
});

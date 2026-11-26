import {test} from "node:test";
import assert from "node:assert/strict";
import {pumpCiOutbox} from "../src/platform/p4-ci-outbox-pump.js";
import type {Wakeup} from "../src/platform/p4-r87-ci-queue.js";
test("direct outbox processing cannot run without disposable CI authorization",async()=>{
 let accessed=false;
 const db={async due():Promise<Wakeup[]>{accessed=true;return [];},async deliver(){return "empty" as const;}};
 await assert.rejects(pumpCiOutbox(db,{}));
 await assert.rejects(pumpCiOutbox(db,{VERCEL:"1",P4_DIRECT_OUTBOX_CI:"true"}));
 assert.equal(accessed,false);
});

import assert from "node:assert/strict";
import {test} from "node:test";
import React,{createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {P4R56CiRecipientAcceptanceController}
 from "../src/lib/p4-r56-ci-recipient-acceptance-controller";
import {P4R56CiRecipientAcceptancePanel}
 from "../src/components/p4-r56-ci-recipient-acceptance";
const TOKEN="a".repeat(64);
const accepted={accepted:true as const,membershipActivated:true as const};
test("R56 valid one-time acceptance contains no invitation token in result",async()=>{
 let got="";
 const ctrl=new P4R56CiRecipientAcceptanceController({
  accept:async(token:string)=>{got=token;return accepted;},
 });
 const state=await ctrl.submit(TOKEN);
 assert.equal(got,TOKEN);assert.equal(state.phase,"accepted");
 assert.equal(state.accepted,true);assert.equal(state.membershipActivated,true);
 assert.equal(JSON.stringify(state).includes(TOKEN),false);
});
test("R56 invalid token fails without network and never appears in state",async()=>{
 let calls=0;
 const ctrl=new P4R56CiRecipientAcceptanceController({
  accept:async()=>{calls++;return accepted;},
 });
 const result=await ctrl.submit("not a real invitation");
 assert.equal(result.phase,"denied");assert.equal(calls,0);
 assert.equal(JSON.stringify(result).includes("not a real invitation"),false);
});
test("R56 submitting blocks duplicate requests and accepted state is one-way",async()=>{
 let done:(value:typeof accepted)=>void=()=>{};
 const pending=new Promise<typeof accepted>(resolve=>done=resolve);
 let requests=0;
 const ctrl=new P4R56CiRecipientAcceptanceController({
  accept:async()=>{requests++;return pending;},
 });
 const first=ctrl.submit(TOKEN);
 assert.equal(ctrl.snapshot().phase,"submitting");
 assert.equal((await ctrl.submit(TOKEN)).phase,"submitting");
 assert.equal(requests,1);
 done(accepted);
 assert.equal((await first).phase,"accepted");
 assert.equal((await ctrl.submit(TOKEN)).phase,"accepted");
 assert.equal(requests,1);
});
test("R56 reset drops late signed acceptance result and removes stale success",async()=>{
 let resolve:(value:typeof accepted)=>void=()=>{};
 const pending=new Promise<typeof accepted>(r=>resolve=r);
 const ctrl=new P4R56CiRecipientAcceptanceController({
  accept:async()=>pending,
 });
 const slow=ctrl.submit(TOKEN);
 ctrl.reset();
 resolve(accepted);
 await slow;
 assert.equal(ctrl.snapshot().phase,"idle");
 assert.equal(ctrl.snapshot().accepted,false);
});
test("R56 rejected recipient errors never display server details or token",async()=>{
 const ctrl=new P4R56CiRecipientAcceptanceController({
  accept:async()=>{throw Error("private bearer JWT and token:"+TOKEN);},
 });
 const state=await ctrl.submit(TOKEN);
 assert.equal(state.phase,"denied");
 assert.equal(JSON.stringify(state).includes(TOKEN),false);
 assert.equal(JSON.stringify(state).includes("JWT"),false);
 ctrl.reset();
 assert.equal(ctrl.snapshot().phase,"idle");
});
test("R56 server-rendered React form masks token and shows accessible success",async()=>{
 const noop=()=>{};
 const ctrl=new P4R56CiRecipientAcceptanceController({
  accept:async()=>accepted,
 });
 let html=renderToStaticMarkup(createElement(P4R56CiRecipientAcceptancePanel,{
  view:ctrl.snapshot(),onSubmit:noop,onReset:noop,
 }));
 for(const text of ["Join your team","Accept invitation",
  'type="password"','autoComplete="off"','role="status"',
  'data-ci-recipient-acceptance="fictional-only"'])
  assert.ok(html.includes(text),text);
 assert.equal(html.includes(TOKEN),false);
 await ctrl.submit(TOKEN);
 html=renderToStaticMarkup(createElement(P4R56CiRecipientAcceptancePanel,{
  view:ctrl.snapshot(),onSubmit:noop,onReset:noop,
 }));
 assert.ok(html.includes("Invitation accepted"));
 assert.equal(html.includes("type=\"password\""),false);
 assert.equal(html.includes(TOKEN),false);
});

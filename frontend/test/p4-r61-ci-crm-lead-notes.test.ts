import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R61CiLeadNotesClient,P4R61CiNoteError,
 parseP4R61LeadNotes} from "../src/lib/p4-r61-ci-lead-notes-client";
import {P4R61CiLeadNotesController}
 from "../src/lib/p4-r61-ci-lead-notes-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const LEAD="10000000-0000-4000-8000-000000000002";
const note={noteId:"10000000-0000-4000-8000-000000000003",
 leadId:LEAD,noteText:"Demo called for a follow up",
 actorUserId:"user_demo_alice",createdAt:"2026-11-24T13:00:00.000Z"};
const HEAD={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),
 {status,headers:HEAD});
const client=(f:typeof fetch)=>new P4R61CiLeadNotesClient(
 "http://127.0.0.1:5561/",async()=>"abc.def.ghi",f,ENV);
const denied=(code:string)=>(e:unknown)=>e instanceof P4R61CiNoteError&&e.code===code;
test("R61 strict note parser accepts canonical synthetic notes only",()=>{
 assert.deepEqual(parseP4R61LeadNotes([note]),[note]);
 assert.equal(parseP4R61LeadNotes([note,note]),null);
 assert.equal(parseP4R61LeadNotes([{...note,tokenHash:"secret"}]),null);
 assert.equal(parseP4R61LeadNotes([{...note,noteText:"real customer@gmail.com"}]),null);
 assert.equal(parseP4R61LeadNotes([{...note,actorUserId:"auth0|fake"}]),null);
});
test("R61 signed note GET/POST uses no browser cookies and revalidates output",async()=>{
 const calls:RequestInit[]=[];
 const f=(async(_url:unknown,opts?:RequestInit)=>{
  calls.push(opts!);return response({scope:"disposable-ci-only",
   data:opts?.method==="GET"?[note]:note});
 }) as typeof fetch;
 assert.deepEqual(await client(f).list(ORG,LEAD),[note]);
 assert.deepEqual(await client(f).add(ORG,LEAD,note.noteText),note);
 assert.deepEqual(calls.map(x=>x.method),["GET","POST"]);
 assert.ok(calls.every(x=>x.credentials==="omit"&&x.cache==="no-store"));
});
test("R61 disallows non-fictional text and invalid IDs before HTTP",async()=>{
 let requests=0;
 const f=(async()=>{requests++;return response({});}) as typeof fetch;
 await assert.rejects(client(f).add(ORG,LEAD,"Actual client named Alice"),
  denied("INVALID_INPUT"));
 await assert.rejects(client(f).list("invalid",LEAD),denied("INVALID_INPUT"));
 assert.equal(requests,0);
});
test("R61 note controller refetches append and clears cross-org on denied read",async()=>{
 let added=false,blocked=false;
 const api={list:async()=>{
  if(blocked)throw Error("sensitive JWT");
  return added?[note]:[];
 },add:async()=>{added=true;return note;}};
 const ctl=new P4R61CiLeadNotesController(api as never);
 assert.equal((await ctl.load(ORG,LEAD)).notes.length,0);
 assert.equal((await ctl.add(ORG,LEAD,note.noteText)).notes.length,1);
 blocked=true;
 assert.equal((await ctl.load(ORG,LEAD)).phase,"denied");
 assert.deepEqual(ctl.snapshot().notes,[]);
 assert.equal(JSON.stringify(ctl.snapshot()).includes("JWT"),false);
});

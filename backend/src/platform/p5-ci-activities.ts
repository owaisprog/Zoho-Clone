import {CiP5SalesBoard} from "./p5-ci-sales-board.js";
import {LeadError} from "./p5-ci-leads.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
const kind=(v:unknown):v is "NOTE"|"TASK"|"CALL"|"MEETING"=>v==="NOTE"||v==="TASK"||v==="CALL"||v==="MEETING";
const title=(v:unknown):v is string=>typeof v==="string"&&/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,74}$/.test(v);
export function parseActivity(v:unknown,deal:string){
 if(!exact(v,"completed,dealId,id,kind,revision,title")||!isCanonicalUuidV4(v.id)||v.dealId!==deal||!kind(v.kind)||!title(v.title)||!((v.completed===false&&v.revision===0)||(v.kind==="TASK"&&v.completed===true&&v.revision===1)))throw new LeadError(503);
 return {id:v.id,dealId:deal,kind:v.kind,title:v.title,completed:v.completed as boolean,revision:v.revision as number};
}
export class CiP5Activities extends CiP5SalesBoard{
 async activities(x:StageIdentity,org:string,deal:unknown,after:unknown){
  const args=this.scope(x,org);if(!isCanonicalUuidV4(deal)||(after!==null&&!isCanonicalUuidV4(after)))throw new LeadError(400);
  return this.transaction(false,async c=>{
   const v:unknown=(await c.query("SELECT p5_ci.read_activities($1,$2,$3,$4,$5) AS data",[...args,deal,after])).rows[0]?.data;
   if(!Array.isArray(v)||v.length>21)throw new LeadError(503);
   let previous=after;const items=v.map(row=>{const a=parseActivity(row,deal);if(previous!==null&&a.id<=previous)throw new LeadError(503);previous=a.id;return a;});
   return {items:items.slice(0,20),nextCursor:items.length===21?items[19]!.id:null};
  });
 }
 async writeActivity(x:StageIdentity,org:string,deal:unknown,id:unknown,raw:unknown){
  const args=this.scope(x,org);if(!isCanonicalUuidV4(deal)||!isCanonicalUuidV4(id))throw new LeadError(400);
  let k:string|null=null,t:string|null=null,expected:number|null=null;
  if(exact(raw,"kind,title")&&kind(raw.kind)&&title(raw.title)){k=raw.kind;t=raw.title;}
  else if(exact(raw,"expectedRevision")&&raw.expectedRevision===0)expected=0;
  else throw new LeadError(400);
  return this.transaction(true,async c=>{const row=parseActivity((await c.query("SELECT p5_ci.write_activity($1,$2,$3,$4,$5,$6,$7,$8) AS data",[...args,deal,id,k,t,expected])).rows[0]?.data,deal);if(row.id!==id)throw new LeadError(503);return row;});
 }
}

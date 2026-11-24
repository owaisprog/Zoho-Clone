/** P4 R42 read-only immutable event projection for signed disposable CI. */
import type {P4R41Role} from "./p4-r41-ci-member-role-contract";
export type P4R42RoleHistory=Readonly<{
 actorUserId:string;targetUserId:string;
 beforeRole:P4R41Role;afterRole:P4R41Role;
 revision:number;occurredAt:string;
}>;
const USER=/^user_demo_[a-z]{2,16}$/;
const ROLE=new Set(["SALES_REP","SALES_MANAGER"]);
function date(value:unknown):value is string{
 if(typeof value!=="string"||
  !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))
  return false;
 const parsed=Date.parse(value);
 return Number.isFinite(parsed)&&new Date(parsed).toISOString()===value;
}
export function parseP4R42RoleHistory(row:unknown):P4R42RoleHistory|null{
 if(!row||typeof row!=="object"||Array.isArray(row))return null;
 const x=row as Record<string,unknown>;
 if(Object.keys(x).sort().join(",")!=="actorUserId,afterRole,beforeRole,occurredAt,revision,targetUserId"||
  typeof x.actorUserId!=="string"||!USER.test(x.actorUserId)||
  typeof x.targetUserId!=="string"||!USER.test(x.targetUserId)||
  typeof x.beforeRole!=="string"||!ROLE.has(x.beforeRole)||
  typeof x.afterRole!=="string"||!ROLE.has(x.afterRole)||
  x.beforeRole===x.afterRole||
  !Number.isSafeInteger(x.revision)||(x.revision as number)<1||
  (x.revision as number)>10000000||!date(x.occurredAt))return null;
 return Object.freeze({
  actorUserId:x.actorUserId,targetUserId:x.targetUserId,
  beforeRole:x.beforeRole as P4R41Role,afterRole:x.afterRole as P4R41Role,
  revision:x.revision as number,occurredAt:x.occurredAt,
 });
}
export function parseP4R42HistoryPage(value:unknown):
 readonly P4R42RoleHistory[]|null{
 if(!Array.isArray(value)||value.length>20)return null;
 const rows=value.map(parseP4R42RoleHistory);
 if(rows.some(x=>x===null))return null;
 const safe=rows as P4R42RoleHistory[];
 if(safe.some((x,i)=>i>0&&safe[i-1]!.occurredAt<x.occurredAt))return null;
 return Object.freeze(safe);
}

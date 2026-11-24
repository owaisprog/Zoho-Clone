/**
 * P4 R44: strict synthetic member directory contract. No real account/email.
 * A directory entry includes status but never an Auth0 subject or token.
 */
import type {P4R41Role} from "./p4-r41-ci-member-role-contract";
export type P4R44CiFilter="all"|"active"|"revoked";
export type P4R44CiDirectoryMember=Readonly<{
 userId:string;email:string|null;role:P4R41Role;revision:number;active:boolean;
}>;
const USER=/^user_demo_[a-z]{2,16}$/;
const EMAIL=/^[a-z0-9._-]+@example[.]com$/;
export function parseP4R44DirectoryMember(row:unknown):
 P4R44CiDirectoryMember|null{
 if(!row||typeof row!=="object"||Array.isArray(row))return null;
 const x=row as Record<string,unknown>;
 if(Object.keys(x).sort().join(",")!=="active,email,revision,role,userId"||
  typeof x.userId!=="string"||!USER.test(x.userId)||
  (x.email!==null&&(typeof x.email!=="string"||!EMAIL.test(x.email)))||
  (x.role!=="SALES_REP"&&x.role!=="SALES_MANAGER")||
  !Number.isSafeInteger(x.revision)||(x.revision as number)<0||
  (x.revision as number)>10000000||typeof x.active!=="boolean")
  return null;
 return Object.freeze({
  userId:x.userId,email:x.email as string|null,role:x.role,
  revision:x.revision as number,active:x.active,
 });
}
export function parseP4R44DirectoryPage(value:unknown,filter:P4R44CiFilter):
 readonly P4R44CiDirectoryMember[]|null{
 if(!Array.isArray(value)||value.length>20)return null;
 const records=value.map(parseP4R44DirectoryMember);
 if(records.some(row=>row===null))return null;
 const entries=records as P4R44CiDirectoryMember[];
 if(new Set(entries.map(row=>row.userId)).size!==entries.length||
  entries.some((row,i)=>i>0&&entries[i-1]!.userId>=row.userId)||
  (filter!=="all"&&entries.some(row=>row.active!==(filter==="active"))))
  return null;
 return Object.freeze(entries);
}

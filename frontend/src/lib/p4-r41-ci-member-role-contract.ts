/** P4 R41: safe, strict shapes returned only from disposable CI. */
export type P4R41Role="SALES_REP"|"SALES_MANAGER";
export type P4R41Member=Readonly<{userId:string;role:P4R41Role;revision:number}>;
const USER=/^user_demo_[a-z]{2,16}$/;
export function parseP4R41Member(input:unknown):P4R41Member|null{
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const obj=input as Record<string,unknown>;
 if(Object.keys(obj).sort().join(",")!=="revision,role,userId"||
  typeof obj.userId!=="string"||!USER.test(obj.userId)||
  (obj.role!=="SALES_REP"&&obj.role!=="SALES_MANAGER")||
  !Number.isSafeInteger(obj.revision)||(obj.revision as number)<0||
  (obj.revision as number)>10000000)return null;
 return Object.freeze({userId:obj.userId,role:obj.role,revision:obj.revision as number});
}
export function parseP4R41Members(input:unknown):readonly P4R41Member[]|null{
 if(!Array.isArray(input)||input.length>20)return null;
 const rows=input.map(parseP4R41Member);
 if(rows.some(x=>!x))return null;
 const safe=rows as P4R41Member[];
 if(new Set(safe.map(x=>x.userId)).size!==safe.length||
  safe.some((x,i)=>i>0&&safe[i-1]!.userId.localeCompare(x.userId)>=0))
  return null;
 return Object.freeze(safe);
}

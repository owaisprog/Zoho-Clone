import {isStageOrgId} from "./staging-membership";
export type SalesGrant={role:"SALES_REP"|"SALES_MANAGER";active:boolean;revision:number};
export type RoleChange={role:SalesGrant["role"];expectedActive:boolean;nextActive:boolean;expectedRevision:number;requestId:string};
export type RoleEditorTransport={
 list(org:string,target:string):Promise<SalesGrant[]>;
 toggle(org:string,target:string,command:RoleChange):Promise<"applied"|"replay"|"conflict"|"denied"|"unavailable">;
};
export function parseSalesGrants(value:unknown):SalesGrant[]{
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("UNAVAILABLE");
 const x=value as Record<string,unknown>;
 if(Object.keys(x).sort().join(",")!=="applicationAccess,items,status"||x.status!=="verified"||x.applicationAccess!==false||!Array.isArray(x.items)||x.items.length>2)throw Error("UNAVAILABLE");
 const seen=new Set<string>();
 return x.items.map(row=>{
  if(!row||typeof row!=="object"||Object.keys(row).sort().join(",")!=="active,revision,role"||
   (row.role!=="SALES_REP"&&row.role!=="SALES_MANAGER")||seen.has(row.role)||typeof row.active!=="boolean"||
   !Number.isInteger(row.revision)||row.revision<0||row.revision>1000000000)throw Error("UNAVAILABLE");
  seen.add(row.role);return {role:row.role,active:row.active,revision:row.revision};
 });
}
export function buildRoleChange(row:SalesGrant,requestId:string):RoleChange{
 if(!isStageOrgId(requestId)||row.revision>=1000000000)throw Error("DENIED");
 return {role:row.role,expectedActive:row.active,nextActive:!row.active,expectedRevision:row.revision,requestId};
}

import {isStageOrgId} from "./staging-membership";
export type TeamGrant={teamId:string;active:boolean;revision:number};
export type TeamChange={teamId:string;expectedActive:boolean;nextActive:boolean;expectedRevision:number;requestId:string};
export type TeamPage={items:TeamGrant[];nextCursor:string|null};
export type TeamEditorTransport={
 list(org:string,target:string,after:string|null):Promise<unknown>;
 toggle(org:string,target:string,command:TeamChange):Promise<"applied"|"replay"|"conflict"|"denied"|"unavailable">;
};
export function parseTeamPage(value:unknown,after:string|null):TeamPage{
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("UNAVAILABLE");
 const x=value as Record<string,unknown>;
 if(Object.keys(x).sort().join(",")!=="applicationAccess,items,nextCursor,status"||x.status!=="verified"||x.applicationAccess!==false||!Array.isArray(x.items)||x.items.length>20)throw Error("UNAVAILABLE");
 let previous=after;
 const items=x.items.map(row=>{
  if(!row||typeof row!=="object"||Array.isArray(row)||Object.keys(row).sort().join(",")!=="active,revision,teamId"||
   !isStageOrgId(row.teamId)||(previous!==null&&row.teamId<=previous)||typeof row.active!=="boolean"||
   !Number.isInteger(row.revision)||row.revision<0||row.revision>1000000000)throw Error("UNAVAILABLE");
  previous=row.teamId;return {teamId:row.teamId,active:row.active,revision:row.revision};
 });
 if(x.nextCursor!==null&&(!isStageOrgId(x.nextCursor)||items.length!==20||x.nextCursor!==previous))throw Error("UNAVAILABLE");
 return {items,nextCursor:x.nextCursor as string|null};
}
export function buildTeamChange(row:TeamGrant,requestId:string):TeamChange{
 if(!isStageOrgId(requestId)||!isStageOrgId(row.teamId)||!Number.isInteger(row.revision)||row.revision<0||row.revision>=1000000000||typeof row.active!=="boolean")throw Error("DENIED");
 return {teamId:row.teamId,expectedActive:row.active,nextActive:!row.active,expectedRevision:row.revision,requestId};
}

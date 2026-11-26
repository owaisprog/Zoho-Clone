import {isStageOrgId} from "./staging-membership";
export type AppNavigation={organizationId:string;membershipRole:"OWNER"|"MEMBER";crmAvailable:boolean};
export type LeadPage={items:{id:string;label:string}[];nextCursor:string|null};
export type AppAccessTransport={navigation(org:string):Promise<AppNavigation>;leads(org:string,after:string|null):Promise<LeadPage>};
const deny=()=>{throw Error("ACCESS_UNAVAILABLE");};
function exact(v:unknown,keys:string):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===keys;}
function unwrap(v:unknown){
 if(!exact(v,"applicationAccess,data,scope")||v.applicationAccess!==false||v.scope!=="disposable-app-read")return deny();
 return v.data;
}
export function parseAppNavigation(v:unknown,org:string):AppNavigation{
 const x=unwrap(v);
 if(!exact(x,"crmAvailable,membershipRole,organizationId")||x.organizationId!==org||(x.membershipRole!=="OWNER"&&x.membershipRole!=="MEMBER")||typeof x.crmAvailable!=="boolean")return deny();
 return {organizationId:org,membershipRole:x.membershipRole,crmAvailable:x.crmAvailable};
}
export function parseLeadPage(v:unknown,after:string|null):LeadPage{
 const x=unwrap(v);
 if(!exact(x,"items,nextCursor")||!Array.isArray(x.items)||x.items.length>20)return deny();
 let previous=after;
 const items=x.items.map(row=>{
  if(!exact(row,"id,label")||!isStageOrgId(row.id)||(previous!==null&&row.id<=previous)||typeof row.label!=="string"||!/^Demo [A-Za-z0-9 ]{1,75}$/.test(row.label))return deny();
  previous=row.id;return {id:row.id,label:row.label};
 });
 if(x.nextCursor!==null&&(!isStageOrgId(x.nextCursor)||items.length!==20||x.nextCursor!==previous))return deny();
 return {items,nextCursor:x.nextCursor as string|null};
}

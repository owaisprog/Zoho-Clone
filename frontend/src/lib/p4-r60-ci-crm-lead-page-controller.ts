/** R60 CRM paginated directory controller, clears stale rows on errors. */
import type {P4R57Lead} from "./p4-r57-ci-crm-lead-client";
import type {P4R60CiCrmLeadPageClient,P4R60LeadFilter}
 from "./p4-r60-ci-crm-lead-page-client";
export type P4R60CrmDirectory=Readonly<{
 phase:"idle"|"ready"|"denied";orgId:string|null;
 filter:P4R60LeadFilter;search:string;
 leads:readonly P4R57Lead[];nextCursor:string|null;message:string;
}>;
const EMPTY:P4R60CrmDirectory=Object.freeze({
 phase:"idle",orgId:null,filter:"all",search:"",
 leads:Object.freeze([]),nextCursor:null,message:"Fictional CRM directory inactive",
});
export class P4R60CiCrmLeadPageController{
 private epoch=0;
 private state:P4R60CrmDirectory=EMPTY;
 constructor(private readonly api:Pick<P4R60CiCrmLeadPageClient,"page">){}
 snapshot():P4R60CrmDirectory{return this.state;}
 private denied():P4R60CrmDirectory{
  this.state=Object.freeze({...EMPTY,phase:"denied",
   message:"CRM directory access denied; prior rows removed"});
  return this.state;
 }
 async refresh(org:string,filter:P4R60LeadFilter="all",search:string=""):
  Promise<P4R60CrmDirectory>{
  const seq=++this.epoch;
  this.state=Object.freeze({...EMPTY,orgId:org,filter,search});
  try{
   const page=await this.api.page(org,filter,search,null);
   if(seq!==this.epoch)return this.state;
   this.state=Object.freeze({...this.state,phase:"ready",
    leads:page.items,nextCursor:page.nextCursor,
    message:"Signed fictional CRM lead page loaded"});
  }catch{if(seq===this.epoch)return this.denied();}
  return this.state;
 }
 async more():Promise<P4R60CrmDirectory>{
  const v=this.state;
  if(v.phase!=="ready"||!v.orgId||!v.nextCursor)
   return this.denied();
  const seq=++this.epoch;
  try{
   const page=await this.api.page(v.orgId,v.filter,v.search,v.nextCursor);
   if(seq!==this.epoch)return this.state;
   const combined=[...v.leads,...page.items];
   if(new Set(combined.map(x=>x.leadId)).size!==combined.length||
    new Set(combined.map(x=>x.contactEmail)).size!==combined.length||
    combined.some((x,i)=>i>0&&x.createdAt>combined[i-1]!.createdAt))
    return this.denied();
   this.state=Object.freeze({...v,leads:Object.freeze(combined),
    nextCursor:page.nextCursor,message:"More persisted fictional leads loaded"});
  }catch{if(seq===this.epoch)return this.denied();}
  return this.state;
 }
 reset():void{++this.epoch;this.state=EMPTY;}
}

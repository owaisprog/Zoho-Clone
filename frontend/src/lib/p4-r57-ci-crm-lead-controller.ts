/** R57 CI-only CRM owner list/create view controller, always read back from DB. */
import type {P4R57CiCrmLeadClient,P4R57Lead,P4R57NewLead}
 from "./p4-r57-ci-crm-lead-client";
export type P4R57CiLeadView=Readonly<{
 phase:"idle"|"ready"|"denied";
 orgId:string|null;leads:readonly P4R57Lead[];
 message:string;
}>;
const INITIAL:P4R57CiLeadView=Object.freeze({
 phase:"idle",orgId:null,leads:Object.freeze([]),
 message:"Fictional CRM leads inactive",
});
export class P4R57CiCrmLeadController{
 private epoch=0;
 private state:P4R57CiLeadView=INITIAL;
 constructor(private readonly client:Pick<P4R57CiCrmLeadClient,"list"|"create">){}
 snapshot():P4R57CiLeadView{return this.state;}
 private deny(org:string):P4R57CiLeadView{
  this.state=Object.freeze({phase:"denied",orgId:org,
   leads:Object.freeze([]),message:"CRM lead operation denied; previous records cleared"});
  return this.state;
 }
 async refresh(org:string):Promise<P4R57CiLeadView>{
  const seq=++this.epoch;
  this.state=Object.freeze({phase:"idle",orgId:org,leads:Object.freeze([]),
   message:"Reading persisted fictional leads"});
  try{
   const leads=await this.client.list(org);
   if(seq!==this.epoch)return this.state;
   this.state=Object.freeze({phase:"ready",orgId:org,leads,
    message:"Persisted fictional CRM leads loaded"});
  }catch{if(seq===this.epoch)return this.deny(org);}
  return this.state;
 }
 async create(org:string,input:P4R57NewLead):Promise<P4R57CiLeadView>{
  if(this.state.phase!=="ready"||this.state.orgId!==org)
   return this.deny(org);
  const seq=++this.epoch;
  this.state=Object.freeze({phase:"idle",orgId:org,leads:Object.freeze([]),
   message:"Creating fictional CRM lead"});
  try{
   await this.client.create(org,input);
   if(seq!==this.epoch)return this.state;
   return this.refresh(org);
  }catch{if(seq===this.epoch)return this.deny(org);}
  return this.state;
 }
 reset():void{++this.epoch;this.state=INITIAL;}
}

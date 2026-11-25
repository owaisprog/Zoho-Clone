/** R73 workspace controller: a verified selected organization is required before displaying any module. */
import type {P4R73CiSalesWorkspaceClient,P4R73SalesOrganization,SalesOverview} from "./p4-r73-ci-sales-workspace-client";
export const SALES_TABS=["Overview","Leads","Accounts","Contacts","Deals","Tasks","Sharing","Search"] as const;
export type SalesTab=typeof SALES_TABS[number];
export type WorkspaceView=Readonly<{phase:"idle"|"loading"|"ready"|"denied";organizations:readonly P4R73SalesOrganization[];orgId:string|null;overview:SalesOverview|null;tab:SalesTab;message:string}>;
const EMPTY:WorkspaceView=Object.freeze({phase:"idle",organizations:[],orgId:null,overview:null,tab:"Overview",message:"Select a sales workspace"});
export class P4R73WorkspaceController{
 private state=EMPTY;private epoch=0;
 constructor(private readonly client:Pick<P4R73CiSalesWorkspaceClient,"list"|"overview">){}
 snapshot(){return this.state;}
 reset(){++this.epoch;this.state=EMPTY;}
 private fail(){this.state=Object.freeze({...EMPTY,phase:"denied",message:"Sales access denied or unavailable. Reload to check current permissions."});return this.state;}
 async select(org:string|null=null,tab:SalesTab="Overview"):Promise<WorkspaceView>{
  const seq=++this.epoch;this.state=Object.freeze({...EMPTY,phase:"loading",message:"Checking sales access"});
  try{
   const organizations=await this.client.list();if(seq!==this.epoch)return this.state;
   const id=org??organizations[0]?.id;
   if(!id||!organizations.some(o=>o.id===id))return this.fail();
   const overview=await this.client.overview(id);if(seq!==this.epoch)return this.state;
   this.state=Object.freeze({phase:"ready",organizations,orgId:id,overview,tab,message:"Verified sales workspace"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async navigate(tab:SalesTab):Promise<WorkspaceView>{
  if(this.state.phase!=="ready"||!this.state.orgId||!SALES_TABS.includes(tab))return this.fail();
  return this.select(this.state.orgId,tab);
 }
}

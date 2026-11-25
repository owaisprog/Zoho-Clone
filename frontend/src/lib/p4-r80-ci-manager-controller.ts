import type {P4R80CiManagerDirectoryClient,P4R80ManagerOrganization} from "./p4-r80-ci-manager-directory-client";
import type {P4R74CiTeamReportsClient} from "./p4-r74-ci-team-reports-client";
export const MANAGER_TABS=["Work","Deal reports","Workload"] as const;
export type ManagerTab=typeof MANAGER_TABS[number];
export type ManagerView=Readonly<{phase:"idle"|"loading"|"ready"|"denied";organizations:readonly P4R80ManagerOrganization[];orgId:string|null;tab:ManagerTab;message:string}>;
const EMPTY:ManagerView=Object.freeze({phase:"idle",organizations:[],orgId:null,tab:"Work",message:"Check manager access"});
export class P4R80ManagerController{
 private state=EMPTY;private epoch=0;
 constructor(private readonly directory:Pick<P4R80CiManagerDirectoryClient,"list">,private readonly reports:Pick<P4R74CiTeamReportsClient,"teams">){}
 snapshot(){return this.state;}
 reset(){++this.epoch;this.state=EMPTY;}
 private deny(){this.state=Object.freeze({...EMPTY,phase:"denied",message:"No current managed workspace access"});return this.state;}
 async select(org:string|null=null,tab:ManagerTab="Work"):Promise<ManagerView>{
  const seq=++this.epoch;this.state=Object.freeze({...EMPTY,phase:"loading",message:"Checking current manager permissions"});
  if(!MANAGER_TABS.includes(tab))return this.deny();
  try{const organizations=await this.directory.list();if(seq!==this.epoch)return this.state;
   const chosen=org??organizations[0]?.id;if(!chosen||!organizations.some(o=>o.id===chosen))return this.deny();
   const teams=await this.reports.teams(chosen);if(seq!==this.epoch)return this.state;if(!teams.length)return this.deny();
   this.state=Object.freeze({phase:"ready",organizations,orgId:chosen,tab,message:"Verified manager workspace"});
  }catch{if(seq===this.epoch)return this.deny();}
  return this.state;
 }
 async navigate(tab:ManagerTab){if(this.state.phase!=="ready"||!this.state.orgId)return this.deny();return this.select(this.state.orgId,tab);}
}

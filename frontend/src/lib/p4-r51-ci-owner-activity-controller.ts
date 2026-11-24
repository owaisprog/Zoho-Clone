/** R51 owner activity model; no tokens in state, stale history cleared on denial. */
import type {P4R51CiOwnerActivityClient,P4R51Event,P4R51Filter}
 from "./p4-r51-ci-owner-activity-client";
export type P4R51View=Readonly<{
 phase:"idle"|"ready"|"denied";
 kind:P4R51Filter;events:readonly P4R51Event[];message:string;
}>;
const INITIAL:P4R51View=Object.freeze({phase:"idle",kind:"all",
 events:Object.freeze([]),message:"Fictional activity feed inactive"});
export class P4R51CiOwnerActivityController{
 private state:P4R51View=INITIAL;
 constructor(private readonly api:Pick<P4R51CiOwnerActivityClient,"list">){}
 snapshot():P4R51View{return this.state;}
 async refresh(org:string,kind:P4R51Filter="all"):Promise<P4R51View>{
  this.state=Object.freeze({phase:"idle",kind,events:Object.freeze([]),
   message:"Reading fictional activity"});
  try{
   const events=await this.api.list(org,kind);
   this.state=Object.freeze({phase:"ready",kind,events,
    message:"Real CI PostgreSQL owner activity loaded"});
  }catch{
   this.state=Object.freeze({phase:"denied",kind,events:Object.freeze([]),
    message:"Activity denied; previous rows cleared"});
  }
  return this.state;
 }
 reset():void{this.state=INITIAL;}
}

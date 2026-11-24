/** R50 CI-only operational scoreboard; no private row cache or JWT storage. */
import type {P4R50CiOwnerSummaryClient,P4R50OwnerCounts}
 from "./p4-r50-ci-owner-summary-client";
export type P4R50OwnerView=Readonly<{
 phase:"idle"|"ready"|"denied";
 counts:P4R50OwnerCounts|null;message:string;
}>;
const INITIAL:P4R50OwnerView=Object.freeze({
 phase:"idle",counts:null,message:"Fictional owner operations summary inactive",
});
export class P4R50CiOwnerSummaryController{
 private state:P4R50OwnerView=INITIAL;
 constructor(private readonly api:Pick<P4R50CiOwnerSummaryClient,"summary">){}
 snapshot():P4R50OwnerView{return this.state;}
 async refresh(org:string):Promise<P4R50OwnerView>{
  try{
   const counts=await this.api.summary(org);
   this.state=Object.freeze({phase:"ready",counts,
    message:"Read-only fictional organization operations from disposable PostgreSQL"});
  }catch{
   this.state=Object.freeze({phase:"denied",counts:null,
    message:"Owner summary denied; all prior counts cleared"});
  }
  return this.state;
 }
 reset():void{this.state=INITIAL;}
}

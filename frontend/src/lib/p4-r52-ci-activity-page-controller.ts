/** R52 owner timeline controller for CI browser-independent interaction. */
import type {P4R51Event,P4R51Filter} from "./p4-r51-ci-owner-activity-client";
import type {P4R52CiActivityPageClient}
 from "./p4-r52-ci-activity-page-client";
export type P4R52ActivityView=Readonly<{
 phase:"idle"|"ready"|"denied";
 kind:P4R51Filter;events:readonly P4R51Event[];
 nextCursor:string|null;message:string;
}>;
const INITIAL:P4R52ActivityView=Object.freeze({
 phase:"idle",kind:"all",events:Object.freeze([]),nextCursor:null,
 message:"CI-only activity pages inactive",
});
export class P4R52CiActivityPageController{
 private state:P4R52ActivityView=INITIAL;
 constructor(private readonly api:Pick<P4R52CiActivityPageClient,"page">){}
 snapshot():P4R52ActivityView{return this.state;}
 private denied():P4R52ActivityView{
  this.state=Object.freeze({...this.state,phase:"denied",
   events:Object.freeze([]),nextCursor:null,
   message:"Activity pagination denied; prior rows removed"});
  return this.state;
 }
 async refresh(org:string,kind:P4R51Filter="all"):Promise<P4R52ActivityView>{
  this.state=Object.freeze({phase:"idle",kind,events:Object.freeze([]),
   nextCursor:null,message:"Loading owner audit events"});
  try{
   const page=await this.api.page(org,kind,null);
   this.state=Object.freeze({...this.state,phase:"ready",
    events:page.items,nextCursor:page.nextCursor,
    message:"Fictional owner audit events from disposable PostgreSQL"});
   return this.state;
  }catch{return this.denied();}
 }
 async more(org:string):Promise<P4R52ActivityView>{
  if(this.state.phase!=="ready"||!this.state.nextCursor)return this.denied();
  try{
   const page=await this.api.page(org,this.state.kind,this.state.nextCursor);
   const combined=[...this.state.events,...page.items];
   if(new Set(combined.map(e=>e.eventId)).size!==combined.length||
    combined.some((x,i)=>i>0&&x.occurredAt>combined[i-1]!.occurredAt))
    return this.denied();
   this.state=Object.freeze({...this.state,phase:"ready",
    events:Object.freeze(combined),nextCursor:page.nextCursor,
    message:"Next signed owner audit page loaded"});
   return this.state;
  }catch{return this.denied();}
 }
 reset():void{this.state=INITIAL;}
}

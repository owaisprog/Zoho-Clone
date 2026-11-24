/** R64 signed fictional CRM follow-up tasks controller; DB re-read required. */
import type {P4R64CiTaskClient,P4R64Task,P4R64NewTask}
 from "./p4-r64-ci-task-client";
export type P4R64TaskView=Readonly<{
 phase:"idle"|"ready"|"denied";
 orgId:string|null;leadId:string|null;tasks:readonly P4R64Task[];
 message:string;
}>;
const EMPTY:P4R64TaskView=Object.freeze({
 phase:"idle",orgId:null,leadId:null,tasks:Object.freeze([]),
 message:"Fictional CRM tasks inactive",
});
export class P4R64CiTaskController{
 private epoch=0;private state:P4R64TaskView=EMPTY;
 constructor(private readonly api:Pick<P4R64CiTaskClient,
  "list"|"create"|"complete">){}
 snapshot():P4R64TaskView{return this.state;}
 private denied():P4R64TaskView{
  this.state=Object.freeze({...EMPTY,phase:"denied",
   message:"CRM follow-up tasks denied; previous records cleared"});
  return this.state;
 }
 async load(org:string,lead:string):Promise<P4R64TaskView>{
  const seq=++this.epoch;this.state=EMPTY;
  try{
   const tasks=await this.api.list(org,lead);
   if(seq!==this.epoch)return this.state;
   this.state=Object.freeze({phase:"ready",orgId:org,leadId:lead,
    tasks,message:"Persisted fictional follow-up tasks loaded"});
  }catch{if(seq===this.epoch)return this.denied();}
  return this.state;
 }
 async create(org:string,lead:string,input:P4R64NewTask):
  Promise<P4R64TaskView>{
  if(this.state.phase!=="ready"||this.state.orgId!==org||
   this.state.leadId!==lead)return this.denied();
  const seq=++this.epoch;this.state=EMPTY;
  try{
   await this.api.create(org,lead,input);
   if(seq!==this.epoch)return this.state;
   return this.load(org,lead);
  }catch{if(seq===this.epoch)return this.denied();}
  return this.state;
 }
 async complete(org:string,lead:string,task:string):
  Promise<P4R64TaskView>{
  const v=this.state;
  if(v.phase!=="ready"||v.orgId!==org||v.leadId!==lead||
   !v.tasks.some(x=>x.taskId===task&&x.status==="OPEN"&&x.revision===0))
   return this.denied();
  const seq=++this.epoch;this.state=EMPTY;
  try{
   await this.api.complete(org,lead,task,0);
   if(seq!==this.epoch)return this.state;
   return this.load(org,lead);
  }catch{if(seq===this.epoch)return this.denied();}
  return this.state;
 }
 reset():void{++this.epoch;this.state=EMPTY;}
}

/** R68 owner-only multi-lead CRM follow-up queue controller. */
import type {P4R68CiDueQueueClient,P4R68DueItem}
 from "./p4-r68-ci-due-queue-client";
import type {P4R64CiTaskClient} from "./p4-r64-ci-task-client";
export type P4R68DueQueueView=Readonly<{
 phase:"idle"|"loading"|"ready"|"denied";
 orgId:string|null;through:string;items:readonly P4R68DueItem[];
 nextCursor:string|null;message:string;
}>;
const EMPTY:P4R68DueQueueView=Object.freeze({
 phase:"idle",orgId:null,through:"2026-12-31",
 items:Object.freeze([]),nextCursor:null,
 message:"Synthetic CRM due queue inactive",
});
export class P4R68CiDueQueueController{
 private epoch=0;private state:P4R68DueQueueView=EMPTY;
 constructor(private readonly client:Pick<P4R68CiDueQueueClient,"page">,
  private readonly tasks:Pick<P4R64CiTaskClient,"complete">){}
 snapshot():P4R68DueQueueView{return this.state;}
 private begin():number{
  const seq=++this.epoch;
  this.state=Object.freeze({...EMPTY,phase:"loading",
   message:"Checking signed organization follow-up tasks"});
  return seq;
 }
 private fail():P4R68DueQueueView{
  this.state=Object.freeze({...EMPTY,phase:"denied",
   message:"Follow-up queue denied; previous tenant records cleared"});
  return this.state;
 }
 private valid(items:readonly P4R68DueItem[],through:string):boolean{
  return new Set(items.map(x=>x.task.taskId)).size===items.length&&
   items.every((x,i)=>x.task.status==="OPEN"&&x.task.dueDate<=through&&
    (i===0||x.task.dueDate>items[i-1]!.task.dueDate||
     (x.task.dueDate===items[i-1]!.task.dueDate&&
      x.task.taskId>items[i-1]!.task.taskId)));
 }
 async load(org:string,through:string="2026-12-31"):
  Promise<P4R68DueQueueView>{
  const seq=this.begin();
  try{
   const page=await this.client.page(org,through,null);
   if(seq!==this.epoch)return this.state;
   if(!this.valid(page.items,through))return this.fail();
   this.state=Object.freeze({...EMPTY,phase:"ready",orgId:org,through,
    items:page.items,nextCursor:page.nextCursor,
    message:"Current signed owner follow-up tasks by due date"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async more():Promise<P4R68DueQueueView>{
  const v=this.state;
  if(v.phase!=="ready"||!v.orgId||!v.nextCursor)
   return this.fail();
  const seq=this.begin();
  try{
   const page=await this.client.page(v.orgId,v.through,v.nextCursor);
   if(seq!==this.epoch)return this.state;
   const items=[...v.items,...page.items];
   if(items.length>400||!this.valid(items,v.through))
    return this.fail();
   this.state=Object.freeze({...v,phase:"ready",
    items:Object.freeze(items),nextCursor:page.nextCursor,
    message:"Additional follow-up tasks loaded from current tenant"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 async complete(taskId:string):Promise<P4R68DueQueueView>{
  const v=this.state;
  if(v.phase!=="ready"||!v.orgId)return this.fail();
  const selected=v.items.find(x=>x.task.taskId===taskId&&
   x.task.status==="OPEN"&&x.task.revision===0);
  if(!selected)return this.fail();
  const seq=this.begin();
  try{
   const done=await this.tasks.complete(v.orgId,selected.task.leadId,
    taskId,0);
   if(seq!==this.epoch)return this.state;
   if(done.taskId!==taskId||done.leadId!==selected.task.leadId||
    done.status!=="DONE"||done.revision!==1)return this.fail();
   const first=await this.client.page(v.orgId,v.through,null);
   if(seq!==this.epoch)return this.state;
   const items=[...first.items];let cursor=first.nextCursor;
   // Re-read enough rows to cover the previously loaded selection.
   while(cursor!==null&&items.length<v.items.length){
    const next=await this.client.page(v.orgId,v.through,cursor);
    if(seq!==this.epoch)return this.state;
    if(next.items.length===0)return this.fail();
    items.push(...next.items);cursor=next.nextCursor;
    if(items.length>400)return this.fail();
   }
   if(items.some(x=>x.task.taskId===taskId)||
    !this.valid(items,v.through))return this.fail();
   this.state=Object.freeze({...v,phase:"ready",
    items:Object.freeze(items),nextCursor:cursor,
    message:"Follow-up completed and removed from open due queue"});
  }catch{if(seq===this.epoch)return this.fail();}
  return this.state;
 }
 reset():void{++this.epoch;this.state=EMPTY;}
}

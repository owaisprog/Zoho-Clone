"use client";
import {useRef,useState} from "react";
import {LeadClientError} from "@/lib/p5-leads-client";
import type {PipelineClient,PipelinePage} from "@/lib/p5-pipelines-client";
import type {Deal} from "@/lib/p5-conversion-client";
import type {DealClient,DealChange} from "@/lib/p5-deals-client";
import type {SalesBoard,SalesBoardClient} from "@/lib/p5-sales-board-client";
const money=(n:number)=>(n/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
type Move={id:string;pipeline:string;search:string;command:DealChange};
export function P5SalesBoard({organizationId,pipelines,deals,client}:{organizationId:string;pipelines:PipelineClient;deals:DealClient;client:SalesBoardClient}){
 const [pipelinePage,setPipelinePage]=useState<PipelinePage|null>(null),[pipeline,setPipeline]=useState(""),[search,setSearch]=useState(""),[appliedSearch,setAppliedSearch]=useState("");
 const [board,setBoard]=useState<SalesBoard|null>(null),[focus,setFocus]=useState<string|null>(null),[pending,setPending]=useState<Move|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const running=useRef(false),dragged=useRef<Deal|null>(null),blocked=busy||!!pending;
 function clear(){setBoard(null);setFocus(null);dragged.current=null;}
 async function run(fn:()=>Promise<void>){
  if(running.current)return;running.current=true;setBusy(true);setMessage("");
  try{await fn();}catch(e){clear();setPipelinePage(null);if(e instanceof LeadClientError&&[400,401,403,404,409].includes(e.status)){setPending(null);setMessage(e.status===409?"Board conflict. Reload before moving another deal.":"Board request denied or invalid.");}else setMessage("Board unavailable. Retry the same pending move if present.");}finally{running.current=false;setBusy(false);}
 }
 function loadPipelines(after:string|null){return run(async()=>{clear();setPipeline("");setPipelinePage(null);const result=await pipelines.list(organizationId,after);setPipelinePage(result);setPipeline(result.items.find(p=>p.isDefault)?.id??result.items[0]?.id??"");setMessage("Board pipelines loaded.");});}
 function load(stage:string|null=null,after:string|null=null,query=search){return run(async()=>{clear();setAppliedSearch(query);setFocus(stage);setBoard(await client.board(organizationId,pipeline,query,stage,after));setMessage("Sales board loaded.");});}
 function move(request:Move){return run(async()=>{
  clear();setPending(request);await deals.write(organizationId,request.id,request.command);setPending(null);
  setPipeline(request.pipeline);setAppliedSearch(request.search);
  try{setBoard(await client.board(organizationId,request.pipeline,request.search));setMessage("Deal moved.");}catch{clear();setMessage("Deal saved. Reload the board to verify its current position.");}
 });}
 function chooseMove(row:Deal,target:string){
  if(blocked||row.pipelineId!==pipeline||!row.nextStages.includes(target)||row.revision>=1000000)return;
  void move({id:row.id,pipeline,search:appliedSearch,command:{operation:"transition",requestId:crypto.randomUUID(),expectedRevision:row.revision,nextStage:target}});
 }
 const count=board?.columns.reduce((n,c)=>n+c.count,0)??0,value=board?.columns.reduce((n,c)=>n+c.valueCents,0)??0;
 const open=board?.columns.filter(c=>c.key!=="WON"&&c.key!=="LOST").reduce((n,c)=>n+c.valueCents,0)??0;
 const won=board?.columns.find(c=>c.key==="WON")?.valueCents??0;
 return <main className="mx-auto max-w-7xl space-y-5 p-6">
 <nav><a href="/">Leads</a> · <a href="/accounts">Accounts</a> · <a href="/contacts">Contacts</a> · <a href="/conversion">Conversion</a> · <a href="/deals">Deals</a> · <a href="/pipelines">Pipelines</a> · <a href="/board">Sales board</a></nav>
 <h1 className="text-2xl font-semibold">Sales CRM — Sales board</h1>
 <p>Fictional opportunities. Totals reflect the current authorized pipeline and search, not collected revenue.</p>
 <section className="flex flex-wrap gap-3" aria-label="Board filters">
 <button disabled={blocked} onClick={()=>void loadPipelines(null)}>Load board pipelines</button>
 {pipelinePage?.nextCursor&&<button disabled={blocked} onClick={()=>void loadPipelines(pipelinePage.nextCursor)}>Next board pipelines</button>}
 <label htmlFor="board-pipeline">Board pipeline</label><select id="board-pipeline" value={pipeline} disabled={blocked} onChange={e=>{clear();setPipeline(e.target.value);}}><option value="">Choose pipeline</option>{pipelinePage?.items.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
 <label htmlFor="board-search">Search opportunities</label><input id="board-search" value={search} maxLength={80} disabled={blocked} onChange={e=>{setSearch(e.target.value);clear();}}/>
 <button disabled={blocked||!pipeline} onClick={()=>void load()}>Load sales board</button>
 </section>
 {pending&&<button disabled={busy} onClick={()=>void move(pending)}>Retry same board move</button>}
 {board&&<><h2>{board.pipelineName}{focus?" — "+focus:""}</h2><section aria-label="Opportunity totals" className="grid grid-cols-2 gap-3 rounded border p-4">
 <p>Visible opportunities: {count}</p><p>Total opportunity value: {money(value)}</p>
 {!focus&&<><p>Open opportunity value: {money(open)}</p><p>Won opportunity value: {money(won)}</p></>}</section>
 {focus&&<button disabled={blocked} onClick={()=>void load(null,null,appliedSearch)}>Back to full board</button>}
 <div className="flex gap-3 overflow-x-auto" aria-label="Kanban columns">{board.columns.map(column=><section key={column.key} aria-label={"Stage "+column.key} className="min-w-64 rounded border p-3 space-y-3"
 onDragOver={e=>{if(!blocked&&dragged.current?.nextStages.includes(column.key))e.preventDefault();}}
 onDrop={e=>{e.preventDefault();const row=dragged.current;dragged.current=null;if(row)chooseMove(row,column.key);}}>
 <h3>{column.label}</h3><p>{column.count} opportunities · {money(column.valueCents)}</p>
 {column.items.map(row=><article key={row.id} aria-label={row.title} className="rounded border p-3" draggable={!blocked&&row.nextStages.length>0&&row.revision<1000000}
 onDragStart={e=>{if(blocked||!row.nextStages.length||row.revision>=1000000){e.preventDefault();return;}dragged.current=row;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",row.id);}} onDragEnd={()=>{dragged.current=null;}}>
 <h4>{row.title}</h4><p>{money(row.valueCents)} · revision {row.revision}</p>
 {row.nextStages.map(target=><button key={target} disabled={blocked||row.revision>=1000000} onClick={()=>chooseMove(row,target)}>Move {row.title} to {target}</button>)}
 </article>)}
 {column.count===0&&<p>No visible opportunities.</p>}{column.nextCursor&&<button disabled={blocked} onClick={()=>void load(column.key,column.nextCursor,appliedSearch)}>Next {column.key} opportunities</button>}
 </section>)}</div></>}
 <p role="status" aria-live="polite">{message}</p></main>;
}

"use client";
import React,{useEffect,useRef,useState} from "react";
import {P4R86InboxPanel} from "./p4-r86-ci-inbox";
import type {P4R86CiInboxClient} from "../lib/p4-r86-ci-inbox-client";
import type {P4R89CiWorkspaceClient,FilePage,FileRow,Navigation} from "../lib/p4-r89-ci-workspace-client";
function FilePanel({api,org,parent}:{api:P4R89CiWorkspaceClient;org:string;parent:string}){
 const [page,setPage]=useState<FilePage|null>(null),[busy,setBusy]=useState(true),[status,setStatus]=useState("Checking files"),[content,setContent]=useState("");
 const epoch=useRef(0);
 async function load(){const seq=++epoch.current;setBusy(true);setPage(null);setStatus("Checking files");
  try{const v=await api.files(org,parent);if(seq===epoch.current){setPage(v);setStatus("Authorized files");}}
  catch{if(seq===epoch.current)setStatus("Files unavailable or access denied");}finally{if(seq===epoch.current)setBusy(false);}
 }
 useEffect(()=>{void load();return()=>{++epoch.current;};},[api,org,parent]);
 async function mutate(work:()=>Promise<void>){if(busy)return;const seq=++epoch.current;setBusy(true);
  try{await work();if(seq===epoch.current){setContent("");await load();}}
  catch{if(seq===epoch.current){setPage(null);setStatus("File action denied");setBusy(false);}}
 }
 async function download(file:FileRow){if(busy)return;const seq=++epoch.current;setBusy(true);
  try{const blob=await api.download(org,file.id);if(seq!==epoch.current)return;const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download="demo-attachment.txt";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);setStatus("Download verified");}
  catch{if(seq===epoch.current){setPage(null);setStatus("File action denied");}}
  finally{if(seq===epoch.current)setBusy(false);}
 }
 async function more(){if(busy||!page?.nextCursor)return;const prior=page,seq=++epoch.current;setBusy(true);
  try{const next=await api.files(org,parent,prior.nextCursor);if(seq===epoch.current)setPage({items:[...prior.items,...next.items],nextCursor:next.nextCursor});}
  catch{if(seq===epoch.current){setPage(null);setStatus("Files unavailable or access denied");}}
  finally{if(seq===epoch.current)setBusy(false);}
 }
 return <section aria-label="Private files"><h2>Private files</h2><p role="status">{status}</p><button type="button" disabled={busy} onClick={()=>void load()}>Refresh files</button>
 {page&&!busy&&<><form onSubmit={e=>{e.preventDefault();void mutate(async()=>{await api.create(org,parent,content);});}}><label>Fictional attachment text<input value={content} onChange={e=>setContent(e.target.value)} maxLength={145}/></label><button type="submit">Upload fictional attachment</button></form>
 <ul>{page.items.map(f=><li key={f.id}><span>{f.state}</span> <span>Revision {f.revision}</span>{f.state==="scan_clean"&&<button type="button" onClick={()=>void download(f)}>Download</button>}{f.state!=="quarantined"&&<button type="button" onClick={()=>void mutate(()=>api.remove(org,f))}>Remove</button>}</li>)}</ul>
 {page.nextCursor&&<button type="button" onClick={()=>void more()}>Load more files</button>}</>}</section>;
}
export function P4R89CiWorkspace(props:{api:P4R89CiWorkspaceClient;inbox:P4R86CiInboxClient;orgId:string;parentId:string;sessionKey:string}){
 return <WorkspaceScope key={props.orgId+":"+props.sessionKey} {...props}/>;
}
function WorkspaceScope({api,inbox,orgId,parentId,sessionKey}:{api:P4R89CiWorkspaceClient;inbox:P4R86CiInboxClient;orgId:string;parentId:string;sessionKey:string}){
 const [nav,setNav]=useState<Navigation|null>(null),[status,setStatus]=useState("Checking workspace");const epoch=useRef(0);
 async function load(){const seq=++epoch.current;setNav(null);setStatus("Checking workspace");try{const v=await api.navigation(orgId);if(seq===epoch.current){setNav(v);setStatus("Workspace authorized");}}catch{if(seq===epoch.current)setStatus("Workspace unavailable or access denied");}}
 useEffect(()=>{void load();return()=>{++epoch.current;};},[api,orgId,sessionKey]);
 return <main><h1>Disposable workspace</h1><p role="status">{status}</p><button type="button" onClick={()=>void load()}>Refresh workspace</button>{nav&&<><p>Membership: {nav.membershipRole}</p>{nav.crmAvailable?<><FilePanel api={api} org={orgId} parent={parentId}/><P4R86InboxPanel client={inbox} orgId={orgId} sessionKey={sessionKey}/></>:<p>CRM access unavailable</p>}</>}</main>;
}

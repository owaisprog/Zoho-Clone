"use client";
import React,{useEffect,useRef,useState} from "react";
import type {P4R86CiInboxClient,NoticePage} from "../lib/p4-r86-ci-inbox-client";
export function P4R86InboxPanel({client,orgId,sessionKey}:{client:P4R86CiInboxClient;orgId:string;sessionKey:string}){
 const epoch=useRef(0),[state,setState]=useState<{key:string;client:P4R86CiInboxClient;page:NoticePage}|null>(null),[busy,setBusy]=useState(true),[message,setMessage]=useState("Checking inbox");
 const key=orgId+":"+sessionKey;
 async function load(append=false){const seq=++epoch.current;setBusy(true);if(!append)setState(null);
  try{const page=await client.page(orgId,append?state?.page.nextCursor??null:null);if(seq!==epoch.current)return;setState(old=>({key,client,page:append&&old?.key===key&&old.client===client?{items:[...old.page.items,...page.items],nextCursor:page.nextCursor}:page}));setMessage("Authorized notifications");}
  catch{if(seq===epoch.current){setState(null);setMessage("Inbox unavailable or access denied");}}
  finally{if(seq===epoch.current)setBusy(false);}
 }
 useEffect(()=>{void load();return()=>{++epoch.current;};},[client,key]);
 async function mark(id:string){if(busy||state?.key!==key||state.client!==client)return;const seq=++epoch.current;setBusy(true);try{await client.markRead(orgId,id);if(seq===epoch.current)await load();}catch{if(seq===epoch.current){setState(null);setMessage("Unable to mark notification");setBusy(false);}}}
 return <section aria-label="Private notifications"><h2>Notifications</h2><p role="status">{message}</p><button type="button" disabled={busy} onClick={()=>void load()}>Refresh</button>{!busy&&state?.key===key&&state.client===client&&<><ul>{state.page.items.map(n=><li key={n.id}><span>{n.kind==="FILE_SCAN_CLEAN"?"Demo attachment scan passed":"Demo attachment rejected"}</span> · <span>{n.read?"Read":"Unread"}</span>{!n.read&&<button type="button" onClick={()=>void mark(n.id)}>Mark read</button>}</li>)}</ul>{state.page.nextCursor&&<button type="button" onClick={()=>void load(true)}>Load more</button>}</>}</section>;
}

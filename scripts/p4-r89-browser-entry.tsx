/** Entry is bundled only by the disposable Playwright smoke, never a Next route. */
import React,{useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {P4R89CiWorkspace} from "../frontend/src/components/p4-r89-ci-workspace";
import {P4R89CiWorkspaceClient} from "../frontend/src/lib/p4-r89-ci-workspace-client";
import {P4R86CiInboxClient} from "../frontend/src/lib/p4-r86-ci-inbox-client";
type Fixtures={a:string;b:string;parent:string;rep:string;owner:string;outside:string};
const config=(window as unknown as {__r89?:Fixtures}).__r89;
if(!config||location.hostname!=="127.0.0.1")throw Error("BROWSER_FIXTURE_REQUIRED");
const f=config,env={CI:"true",GITHUB_ACTIONS:"true",P4_R89_BROWSER_CI:"true",NODE_ENV:"test"};
function App(){
 const [actor,setActor]=useState<"rep"|"owner"|"outside">("rep"),[org,setOrg]=useState(f.a);
 const clients=useMemo(()=>{const token=async()=>f[actor];return {api:new P4R89CiWorkspaceClient(location.origin,token,env),inbox:new P4R86CiInboxClient(location.origin,token,fetch,env)};},[actor]);
 return <><header><label>Fixture session<select value={actor} onChange={e=>setActor(e.target.value as typeof actor)}><option value="rep">Sales rep</option><option value="owner">Organization owner</option><option value="outside">Other company owner</option></select></label><label>Fixture organization<select value={org} onChange={e=>setOrg(e.target.value)}><option value={f.a}>Demo company A</option><option value={f.b}>Demo company B</option></select></label></header><P4R89CiWorkspace {...clients} orgId={org} parentId={f.parent} sessionKey={actor}/></>;
}
createRoot(document.getElementById("root")!).render(<App/>);

"use client";
/**
 * R56 fictional recipient invitation confirmation UI.
 * Token exists only in local password input until submission; never in
 * rendered success/error state, URL, logs or React server markup.
 * No route mounts this component outside disposable CI harness.
 */
import React,{useEffect,useState,type FormEvent} from "react";
import type {P4R56CiRecipientAcceptanceController,P4R56RecipientView}
 from "../lib/p4-r56-ci-recipient-acceptance-controller";
export type P4R56RecipientPanelProps=Readonly<{
 view:P4R56RecipientView;
 onSubmit:(token:string)=>void;
 onReset:()=>void;
}>;
export function P4R56CiRecipientAcceptancePanel(p:P4R56RecipientPanelProps){
 const [token,setToken]=useState("");
 const busy=p.view.phase==="submitting";
 const accepted=p.view.phase==="accepted";
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(busy||accepted)return;
  const value=token;
  setToken("");
  p.onSubmit(value);
 };
 const clear=()=>{setToken("");p.onReset();};
 return (
  <main data-ci-recipient-acceptance="fictional-only"
   className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
   <section aria-label="Accept fictional team invitation"
    className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">
     CI only · fictional invitation
    </p>
    <h1 className="mt-3 text-2xl font-bold">Join your team</h1>
    <p className="mt-2 text-sm text-slate-600">
     Confirm your one-time invitation using the account that received it.
    </p>
    <div role={p.view.phase==="denied"?"alert":"status"}
     aria-live="polite"
     className="my-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
     {p.view.message}
    </div>
    {!accepted&&<form onSubmit={submit} className="space-y-4">
     <label htmlFor="ci-recipient-token"
      className="block text-sm font-semibold">Invitation token
      <input id="ci-recipient-token" name="invitation-token"
       type="password" autoComplete="off" spellCheck={false}
       inputMode="text" minLength={64} maxLength={64}
       pattern="[0-9a-f]{64}" required
       value={token} onChange={e=>setToken(e.target.value)}
       disabled={busy}
       aria-describedby="ci-recipient-token-hint"
       className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"/>
     </label>
     <p id="ci-recipient-token-hint" className="text-xs text-slate-500">
      Use the 64-character token from the fictional invitation. Tokens are never displayed after submission.
     </p>
     <button type="submit" disabled={busy}
      className="w-full rounded-lg bg-indigo-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
      {busy?"Checking invitation…":"Accept invitation"}
     </button>
    </form>}
    {(accepted||p.view.phase==="denied")&&
     <button type="button" onClick={clear}
      className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
      {accepted?"Finish":"Try another invitation"}
     </button>}
    <p className="mt-6 text-xs text-slate-500">
     This isolated test interface does not access real organizations or email.
    </p>
   </section>
  </main>
 );
}
export function P4R56CiRecipientAcceptanceBound({
 controller,
}:Readonly<{controller:P4R56CiRecipientAcceptanceController}>){
 const [view,setView]=useState<P4R56RecipientView>(controller.snapshot());
 useEffect(()=>()=>controller.reset(),[controller]);
 const submit=(token:string)=>{
  const result=controller.submit(token);
  setView(controller.snapshot());
  void result.then(setView);
 };
 const reset=()=>{controller.reset();setView(controller.snapshot());};
 return <P4R56CiRecipientAcceptancePanel
  view={view} onSubmit={submit} onReset={reset}/>;
}

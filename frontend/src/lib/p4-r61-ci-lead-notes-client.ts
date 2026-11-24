/** R61 strict signed localhost immutable fictional CRM note client. */
export type P4R61LeadNote=Readonly<{
 noteId:string;leadId:string;noteText:string;
 actorUserId:string;createdAt:string;
}>;
export class P4R61CiNoteError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TEXT=/^Demo [A-Za-z0-9 ,.!?-]{8,130}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const ERRORS:Readonly<Record<number,P4R61CiNoteError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R61CiNoteError["code"]):never=>{
 throw new P4R61CiNoteError(status,code);
};
export function parseP4R61LeadNote(input:unknown):P4R61LeadNote|null{
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const v=input as Record<string,unknown>;
 if(Object.keys(v).sort().join(",")!==
  "actorUserId,createdAt,leadId,noteId,noteText"||
  typeof v.noteId!=="string"||!UUID.test(v.noteId)||
  typeof v.leadId!=="string"||!UUID.test(v.leadId)||
  typeof v.actorUserId!=="string"||!USER.test(v.actorUserId)||
  typeof v.noteText!=="string"||!TEXT.test(v.noteText)||
  typeof v.createdAt!=="string"||!ISO.test(v.createdAt)||
  !Number.isFinite(Date.parse(v.createdAt))||
  new Date(v.createdAt).toISOString()!==v.createdAt)
  return null;
 return Object.freeze({noteId:v.noteId,leadId:v.leadId,
  noteText:v.noteText,actorUserId:v.actorUserId,createdAt:v.createdAt});
}
export function parseP4R61LeadNotes(input:unknown):
 readonly P4R61LeadNote[]|null{
 if(!Array.isArray(input)||input.length>20)return null;
 const rows=input.map(parseP4R61LeadNote);
 if(rows.some(x=>x===null))return null;
 const notes=rows as P4R61LeadNote[];
 if(new Set(notes.map(x=>x.noteId)).size!==notes.length||
  notes.some((x,i)=>i>0&&x.createdAt>notes[i-1]!.createdAt))
  return null;
 return Object.freeze(notes);
}
export class P4R61CiLeadNotesClient{
 constructor(private readonly baseUrl:string,private readonly token:()=>Promise<string>,
  private readonly transport:typeof fetch=fetch,
  private readonly env:NodeJS.ProcessEnv=process.env){
  this.guard();
  if(typeof token!=="function"||typeof transport!=="function")
   deny(503,"UNAVAILABLE");
 }
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||
   this.env.NODE_ENV==="production")deny(503,"UNAVAILABLE");
  let u:URL;
  try{u=new URL(this.baseUrl);}catch{return deny(503,"UNAVAILABLE");}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||
   u.pathname!=="/"||u.search||u.hash||u.username||u.password)
   deny(503,"UNAVAILABLE");
 }
 private async call(org:string,lead:string,method:"GET"|"POST",
  input?:{noteText:string}):Promise<unknown>{
  if(!UUID.test(org)||!UUID.test(lead))return deny(400,"INVALID_INPUT");
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return deny(401,"IDENTITY_REQUIRED");
  let response:Response;
  try{
   const path="/_p4_r33_ci/owner/"+org+"/leads/"+lead+"/notes";
   response=await this.transport(new URL(path,this.baseUrl),{
    method,headers:{"Authorization":"Bearer "+jwt,"Accept":"application/json",
     ...(method==="POST"?{"Content-Type":"application/json"}:{})},
    ...(method==="POST"?{body:JSON.stringify(input)}:{}),
    credentials:"omit",redirect:"error",cache:"no-store",
    signal:AbortSignal.timeout(3000),
   });
  }catch{return deny(503,"UNAVAILABLE");}
  if(response.headers.get("cache-control")!=="no-store, private"||
   response.headers.get("x-content-type-options")!=="nosniff")
   return deny(503,"INVALID_RESPONSE");
  let body:unknown;
  try{body=await response.json();}catch{return deny(503,"INVALID_RESPONSE");}
  if(!response.ok){
   if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).join(",")!=="error")
    return deny(503,"INVALID_RESPONSE");
   const e=(body as {error?:unknown}).error;
   if(!e||typeof e!=="object"||Array.isArray(e)||
    Object.keys(e).join(",")!=="code"||
    !ERRORS[response.status]||
    (e as {code?:unknown}).code!==ERRORS[response.status])
    return deny(503,"INVALID_RESPONSE");
   return deny(response.status,ERRORS[response.status]!);
  }
  if(response.status!==200||!body||typeof body!=="object"||
   Array.isArray(body)||Object.keys(body).sort().join(",")!=="data,scope")
   return deny(503,"INVALID_RESPONSE");
  const envelope=body as Record<string,unknown>;
  if(envelope.scope!=="disposable-ci-only")return deny(503,"INVALID_RESPONSE");
  return envelope.data;
 }
 async list(org:string,lead:string):Promise<readonly P4R61LeadNote[]>{
  const records=parseP4R61LeadNotes(await this.call(org,lead,"GET"));
  if(records===null||records.some(n=>n.leadId!==lead))
   return deny(503,"INVALID_RESPONSE");
  return records;
 }
 async add(org:string,lead:string,noteText:string):Promise<P4R61LeadNote>{
  if(typeof noteText!=="string"||!TEXT.test(noteText))
   return deny(400,"INVALID_INPUT");
  const value=parseP4R61LeadNote(await this.call(org,lead,"POST",{noteText}));
  if(!value||value.leadId!==lead||value.noteText!==noteText)
   return deny(503,"INVALID_RESPONSE");
  return value;
 }
}

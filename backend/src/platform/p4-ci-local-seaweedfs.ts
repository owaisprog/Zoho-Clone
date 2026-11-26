/** Narrow S3 wire adapter for disposable loopback CI/dev fixtures only.
 * No ambient AWS credentials, arbitrary URL, redirects, customer data or production signing.
 */
import {createHash,createHmac} from "node:crypto";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import {requireLocalFileScope,type LocalFileArea,type LocalObjectStore} from "./p4-ci-local-files.js";
type Env=Readonly<Record<string,string|undefined>>;
const origin="http://127.0.0.1:18334",host="127.0.0.1:18334";
const buckets={quarantine:"zoho-local-quarantine",clean:"zoho-local-clean"} as const;
const deny=()=>{throw Error("P4_LOCAL_SEAWEED_DENIED");};
const sha=(bytes:string|Buffer)=>createHash("sha256").update(bytes).digest("hex");
const hmac=(key:string|Buffer,value:string)=>createHmac("sha256",key).update(value).digest();
export function readLocalSeaweedConfig(env:Env){
 requireLocalFileScope(env);
 const access=env.P4_LOCAL_SEAWEED_ACCESS,secret=env.P4_LOCAL_SEAWEED_SECRET;
 if(env.P4_LOCAL_SEAWEED_ENABLED!=="true"||env.P4_LOCAL_SEAWEED_ENDPOINT!==origin||
    !access||!/^local[0-9a-f]{24}$/.test(access)||!secret||!(/^[0-9a-f]{64}$/).test(secret))return deny();
 return {access,secret};
}
export function localObjectPath(area:LocalFileArea,id?:string){
 if(area!=="clean"&&area!=="quarantine")return deny();
 if(id!==undefined&&!isCanonicalUuidV4(id))return deny();
 return "/"+buckets[area]+(id===undefined?"":"/"+id);
}
function signedHeaders(method:string,path:string,bytes:Buffer,config:{access:string;secret:string}){
 const date=new Date().toISOString().replace(/[:-]|\.\d{3}/g,""),day=date.slice(0,8);
 const digest=sha(bytes),scope=day+"/us-east-1/s3/aws4_request";
 const names="host;x-amz-content-sha256;x-amz-date";
 const canonical=[method,path,"","host:"+host+"\nx-amz-content-sha256:"+digest+"\nx-amz-date:"+date+"\n",names,digest].join("\n");
 const message=["AWS4-HMAC-SHA256",date,scope,sha(canonical)].join("\n");
 const key=hmac(hmac(hmac(hmac("AWS4"+config.secret,day),"us-east-1"),"s3"),"aws4_request");
 const signature=hmac(key,message).toString("hex");
 return {"x-amz-date":date,"x-amz-content-sha256":digest,
  Authorization:"AWS4-HMAC-SHA256 Credential="+config.access+"/"+scope+", SignedHeaders="+names+", Signature="+signature};
}
async function boundedRead(response:Response){
 if(!response.body)return deny();
 const reader=response.body.getReader(),parts:Buffer[]=[];
 let length=0;
 try{
  for(;;){
   const next=await reader.read();
   if(next.done)break;
   length+=next.value.byteLength;
   if(length>4096){await reader.cancel();return deny();}
   parts.push(Buffer.from(next.value));
  }
  return Buffer.concat(parts,length);
 }finally{reader.releaseLock();}
}
export class LocalSeaweedStore implements LocalObjectStore{
 private readonly owned=new Map<string,{area:LocalFileArea;id:string}>();
 private closed=false;
 constructor(private readonly env:Env){readLocalSeaweedConfig(env);}
 private async request(method:"HEAD"|"GET"|"PUT"|"DELETE",area:LocalFileArea,id?:string,bytes=Buffer.alloc(0)){
  const config=readLocalSeaweedConfig(this.env);
  if(method!=="HEAD"&&!isCanonicalUuidV4(id))return deny();
  const path=localObjectPath(area,id);
  if(bytes.length>4096)return deny();
  const response=await fetch(origin+path,{method,headers:signedHeaders(method,path,bytes,config),
   ...(method==="PUT"?{body:Uint8Array.from(bytes)}:{}),redirect:"error",signal:AbortSignal.timeout(5000)});
  if(!response.ok){await response.body?.cancel();return deny();}
  if(method==="GET")return boundedRead(response);
  await response.body?.cancel();
  return Buffer.alloc(0);
 }
 async ready(){
  if(this.closed)return deny();
  for(const area of ["quarantine","clean"] as const){
   await this.request("HEAD",area);
   const anonymous=await fetch(origin+localObjectPath(area),{method:"HEAD",redirect:"error",signal:AbortSignal.timeout(5000)});
   if(anonymous.status!==401&&anonymous.status!==403)return deny();
  }
 }
 async put(area:LocalFileArea,id:string,bytes:Buffer){
  if(this.closed||!isCanonicalUuidV4(id)||!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>4096)return deny();
  const key=localObjectPath(area,id);
  if(this.owned.has(key))return deny();
  // Reserve before I/O. Cleanup covers ambiguous PUT results, not arbitrary objects.
  this.owned.set(key,{area,id});
  await this.request("PUT",area,id,Buffer.from(bytes));
 }
 async read(area:LocalFileArea,id:string){
  if(this.closed||!isCanonicalUuidV4(id)||!this.owned.has(localObjectPath(area,id)))return deny();
  return this.request("GET",area,id);
 }
 async close(){
  this.closed=true;
  for(const [key,{area,id}] of this.owned){
   await this.request("DELETE",area,id);
   this.owned.delete(key);
  }
 }
}

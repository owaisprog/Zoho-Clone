export type FileNotice=Readonly<{id:string;kind:"FILE_SCAN_CLEAN"|"FILE_SCAN_REJECTED";read:boolean;fileId:string}>;
export type NoticePage=Readonly<{items:readonly FileNotice[];nextCursor:string|null}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const id=(x:unknown):x is string=>typeof x==="string"&&uuid.test(x);
const obj=(x:unknown,keys:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===keys;
export class NoticeError extends Error{constructor(public readonly status:number){super("NOTICE_REQUEST_FAILED");}}
export class P4R86CiInboxClient{
 constructor(private readonly base:string,private readonly token:()=>Promise<string>,private readonly transport:typeof fetch=fetch,private readonly env:NodeJS.ProcessEnv=process.env){this.guard();}
 private guard(){
  if(this.env.CI!=="true"||this.env.GITHUB_ACTIONS!=="true"||this.env.NODE_ENV==="production")throw new NoticeError(503);
  let u:URL;try{u=new URL(this.base);}catch{throw new NoticeError(503);}
  if(u.protocol!=="http:"||u.hostname!=="127.0.0.1"||!u.port||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw new NoticeError(503);
 }
 private async request(org:string,path:string,post=false):Promise<unknown>{
  this.guard();if(!id(org))throw new NoticeError(400);
  const token=await this.token();if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>10000)throw new NoticeError(401);
  let r:Response;try{r=await this.transport(new URL("/inbox/"+org+path,this.base),{method:post?"POST":"GET",headers:{Authorization:"Bearer "+token,Accept:"application/json",...(post?{"Content-Type":"application/json"}:{})},...(post?{body:"{}"}:{}),redirect:"error",credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(3000)});}catch{throw new NoticeError(503);}
  if(r.headers.get("cache-control")!=="no-store, private"||r.headers.get("x-content-type-options")!=="nosniff")throw new NoticeError(503);
  if(!r.ok)throw new NoticeError([400,401,403,409,503].includes(r.status)?r.status:503);
  const v:unknown=await r.json();if(!obj(v,"data,scope")||v.scope!=="disposable-ci-only")throw new NoticeError(503);return v.data;
 }
 async page(org:string,after:string|null=null):Promise<NoticePage>{
  if(after!==null&&!id(after))throw new NoticeError(400);
  const v=await this.request(org,"/notices"+(after?"?after="+after:""));
  if(!obj(v,"items,nextCursor")||!Array.isArray(v.items)||v.items.length>20)throw new NoticeError(503);
  let prior=after??"";
  for(const n of v.items){if(!obj(n,"fileId,id,kind,read")||!id(n.id)||!id(n.fileId)||n.id<=prior||!["FILE_SCAN_CLEAN","FILE_SCAN_REJECTED"].includes(n.kind as string)||typeof n.read!=="boolean")throw new NoticeError(503);prior=n.id;}
  if(v.nextCursor!==null&&(v.items.length!==20||v.nextCursor!==prior))throw new NoticeError(503);
  return {items:v.items as FileNotice[],nextCursor:v.nextCursor as string|null};
 }
 async markRead(org:string,notice:string){if(!id(notice))throw new NoticeError(400);const v=await this.request(org,"/notices/"+notice+"/read",true);if(!obj(v,"id,read")||v.id!==notice||v.read!==true)throw new NoticeError(503);return {id:notice,read:true as const};}
}

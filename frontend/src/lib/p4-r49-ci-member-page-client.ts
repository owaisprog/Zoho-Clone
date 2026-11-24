/** R49 fake owner member page HTTP client, CI loopback only. */
import {parseP4R44DirectoryPage,type P4R44CiDirectoryMember,
 type P4R44CiFilter} from "./p4-r44-ci-member-directory-contract";
export type P4R49MemberPage=Readonly<{
 items:readonly P4R44CiDirectoryMember[];nextCursor:string|null;
}>;
export class P4R49CiPageError extends Error{
 constructor(public readonly status:number,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|
  "UNAVAILABLE"|"INVALID_RESPONSE"){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{12}$/;
const CODES:Readonly<Record<number,P4R49CiPageError["code"]>>={
 400:"INVALID_INPUT",401:"IDENTITY_REQUIRED",403:"ACCESS_DENIED",
 409:"CONFLICT",503:"UNAVAILABLE",
};
const deny=(status:number,code:P4R49CiPageError["code"]):never=>{
 throw new P4R49CiPageError(status,code);
};
export class P4R49CiMemberPageClient{
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
  let url:URL;
  try{url=new URL(this.baseUrl);}catch{return deny(503,"UNAVAILABLE");}
  if(url.protocol!=="http:"||url.hostname!=="127.0.0.1"||
   !url.port||url.pathname!=="/"||url.search||url.hash||
   url.username||url.password)deny(503,"UNAVAILABLE");
 }
 async page(org:string,status:P4R44CiFilter,search:string,
  cursor:string|null=null):Promise<P4R49MemberPage>{
  if(!UUID.test(org)||!["all","active","revoked"].includes(status)||
   typeof search!=="string"||search.length>40||
   !/^[a-zA-Z0-9._@-]*$/.test(search)||
   (cursor!==null&&(typeof cursor!=="string"||cursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor))))
   return deny(400,"INVALID_INPUT");
  this.guard();
  let jwt:string;
  try{jwt=await this.token();}catch{return deny(401,"IDENTITY_REQUIRED");}
  if(typeof jwt!=="string"||jwt.length>10000||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return deny(401,"IDENTITY_REQUIRED");
  const q=search.toLowerCase();
  let response:Response;
  try{
   const path="/_p4_r33_ci/owner/"+org+
    "/member-directory/page?status="+status+"&q="+encodeURIComponent(q)+
    "&cursor="+encodeURIComponent(cursor??"");
   response=await this.transport(new URL(path,this.baseUrl),{
    method:"GET",headers:{"Authorization":"Bearer "+jwt,
     "Accept":"application/json"},
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
    Object.keys(e).join(",")!=="code"||!CODES[response.status]||
    (e as {code?:unknown}).code!==CODES[response.status])
    return deny(503,"INVALID_RESPONSE");
   return deny(response.status,CODES[response.status]!);
  }
  if(response.status!==200||!body||typeof body!=="object"||
   Array.isArray(body)||Object.keys(body).sort().join(",")!=="data,scope")
   return deny(503,"INVALID_RESPONSE");
  const env=body as Record<string,unknown>;
  if(env.scope!=="disposable-ci-only"||!env.data||
   typeof env.data!=="object"||Array.isArray(env.data)||
   Object.keys(env.data).sort().join(",")!=="items,nextCursor")
   return deny(503,"INVALID_RESPONSE");
  const result=env.data as {items?:unknown;nextCursor?:unknown};
  const items=parseP4R44DirectoryPage(result.items,status);
  if(items===null||
   (result.nextCursor!==null&&(typeof result.nextCursor!=="string"||
    result.nextCursor.length>1024||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(result.nextCursor)))||
   (result.nextCursor!==null&&items.length!==20)||
   items.some(x=>q!==""&&!x.userId.includes(q)&&
    !(x.email??"").includes(q)))
   return deny(503,"INVALID_RESPONSE");
  return Object.freeze({items,nextCursor:result.nextCursor});
 }
}

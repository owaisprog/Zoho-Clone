/**
 * Batch 16: CI-only tamper-evident, tenant-and-actor-bound audit cursor.
 * Never export a secret or use this synthetic key as a production signing key.
 * The token carries no email, subject or audit payload.
 */
import {createHmac,timingSafeEqual} from "node:crypto";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import {P4R7CiReadDeniedError} from "./p4-r7-ci-prisma-reader.js";

export type P4R16CursorScope=Readonly<{organizationId:string;actorId:string}>;
const MAX_TOKEN=1024;
const MAX_AGE_SECONDS=300;
const DOMAIN="p4-r16-audit-cursor-v1";
type Body={v:1;org:string;actor:string;after:string;limit:number;iat:number;exp:number};
function deny():never{throw new P4R7CiReadDeniedError();}
function validLimit(n:unknown):n is number{
 return typeof n==="number"&&Number.isSafeInteger(n)&&n>=1&&n<=20;
}
function validTime(n:unknown):n is number{return typeof n==="number"&&Number.isSafeInteger(n)&&n>=0;}
function validSecret(secret:unknown):secret is string{
 return typeof secret==="string"&&secret.length>=32&&secret.length<=128&&
  /^[a-zA-Z0-9_-]+$/.test(secret);
}
function sign(encoded:string,secret:string):Buffer{
 return createHmac("sha256",Buffer.from(secret,"utf8"))
  .update(DOMAIN+"\n"+encoded,"utf8").digest();
}
function b64(buf:Buffer):string{return buf.toString("base64url");}
function scopeValid(s:P4R16CursorScope):boolean{
 return isCanonicalUuidV4(s?.organizationId)&&isCanonicalUuidV4(s?.actorId);
}
export function issueP4R16CiAuditCursor(
 scope:P4R16CursorScope,after:string,limit:number,
 nowSeconds:number,secret:string,
):string{
 if(!scopeValid(scope)||!isCanonicalUuidV4(after)||!validLimit(limit)||
  !validTime(nowSeconds)||nowSeconds>Number.MAX_SAFE_INTEGER-MAX_AGE_SECONDS||
  !validSecret(secret))deny();
 const payload:Body={v:1,org:scope.organizationId,actor:scope.actorId,
  after,limit,iat:nowSeconds,exp:nowSeconds+MAX_AGE_SECONDS};
 const encoded=Buffer.from(JSON.stringify(payload),"utf8").toString("base64url");
 const token=encoded+"."+b64(sign(encoded,secret));
 if(token.length>MAX_TOKEN)deny();
 return token;
}
export function verifyP4R16CiAuditCursor(
 token:unknown,scope:P4R16CursorScope,limit:number,
 nowSeconds:number,secret:string,
):string{
 if(typeof token!=="string"||token.length>MAX_TOKEN||
  !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||
  !scopeValid(scope)||!validLimit(limit)||!validTime(nowSeconds)||
  !validSecret(secret))deny();
 const [encoded,mac]=token.split(".");
 if(!encoded||!mac||mac.length!==43)deny();
 const signature=Buffer.from(mac,"base64url");
 const calculated=sign(encoded,secret);
 if(signature.length!==calculated.length||
  !timingSafeEqual(signature,calculated))deny();
 let object:unknown;
 try{
  const decoded=Buffer.from(encoded,"base64url").toString("utf8");
  object=JSON.parse(decoded);
  if(Buffer.from(JSON.stringify(object),"utf8").toString("base64url")!==encoded)
   deny();
 }catch{deny();}
 if(!object||typeof object!=="object"||Array.isArray(object))deny();
 const p=object as Record<string,unknown>;
 if(Object.keys(p).sort().join(",")!=="actor,after,exp,iat,limit,org,v"||
  p.v!==1||p.org!==scope.organizationId||p.actor!==scope.actorId||
  !isCanonicalUuidV4(p.after)||p.limit!==limit||
  !validTime(p.iat)||!validTime(p.exp)||
  p.iat>nowSeconds||p.exp<=nowSeconds||
  p.exp-p.iat!==MAX_AGE_SECONDS)deny();
 return p.after;
}

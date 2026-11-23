/**
 * P4 Batch 17: disposable-only, bounded audit cursor key rotation.
 * Explicit key IDs, distinct keys and a separately configured previous key.
 * No production secrets, remote KMS, durable key store or rollout here.
 */
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import {P4R7CiReadDeniedError} from "./p4-r7-ci-prisma-reader.js";
import {issueP4R16CiAuditCursor,verifyP4R16CiAuditCursor,
 type P4R16CursorScope} from "./p4-r16-ci-signed-audit-cursor.js";

export type P4R17CiKey=Readonly<{id:string;secret:string}>;
export type P4R17CiKeyring=Readonly<{
 current:P4R17CiKey;previous?:P4R17CiKey;
}>;
const ID=/^[a-z][a-z0-9_-]{2,23}$/;
const SECRET=/^[A-Za-z0-9_-]{32,128}$/;
const MAX=1100;
function denied():never{throw new P4R7CiReadDeniedError();}
function isKey(x:unknown):x is P4R17CiKey{
 if(!x||typeof x!=="object"||Array.isArray(x))return false;
 const p=x as Record<string,unknown>;
 return Object.keys(p).sort().join(",")==="id,secret"&&
  typeof p.id==="string"&&ID.test(p.id)&&
  typeof p.secret==="string"&&SECRET.test(p.secret);
}
function assertRing(ring:unknown):asserts ring is P4R17CiKeyring{
 if(!ring||typeof ring!=="object"||Array.isArray(ring))denied();
 const r=ring as Record<string,unknown>;
 const names=Object.keys(r).sort().join(",");
 if(names!=="current"&&names!=="current,previous")denied();
 if(!isKey(r.current)||!(r.previous===undefined||isKey(r.previous)))denied();
 if(r.previous){
  const p=r.previous as P4R17CiKey;
  if(p.id===(r.current as P4R17CiKey).id||
     p.secret===(r.current as P4R17CiKey).secret)denied();
 }
}
export function issueP4R17CiRotatingCursor(
 scope:P4R16CursorScope,afterId:string,limit:number,nowSeconds:number,
 ring:P4R17CiKeyring,
):string{
 assertRing(ring);
 const inner=issueP4R16CiAuditCursor(
  scope,afterId,limit,nowSeconds,ring.current.secret);
 const token="r17."+ring.current.id+"."+inner;
 if(token.length>MAX)denied();
 return token;
}
/** Any unknown, retired, modified or future key ID fails BEFORE the DB read. */
export function verifyP4R17CiRotatingCursor(
 token:unknown,scope:P4R16CursorScope,limit:number,nowSeconds:number,
 ring:P4R17CiKeyring,
):string{
 assertRing(ring);
 if(typeof token!=="string"||token.length>MAX||
  !/^r17\.[a-z][a-z0-9_-]{2,23}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
  denied();
 const parts=token.split(".");
 if(parts.length!==4)denied();
 const keyId=parts[1];
 const key=ring.current.id===keyId?ring.current:
  ring.previous?.id===keyId?ring.previous:null;
 if(!key)denied();
 // The R16 MAC binds tenant, actor, limit and 5-minute expiry. Key IDs
 // cannot alias, and distinct key material prevents prefix swapping.
 return verifyP4R16CiAuditCursor(parts[2]+"."+parts[3],
  scope,limit,nowSeconds,key.secret);
}

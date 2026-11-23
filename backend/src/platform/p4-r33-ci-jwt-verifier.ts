/**
 * P4 R33: real RS256 cryptographic verification against an INJECTED,
 * pinned in-memory fictional JWKS. The example issuer is NOT Auth0's
 * live JWKS endpoint and no production provider access is performed.
 *
 * No trust in decoded token claims, email, tenant or role headers.
 */
import {createPublicKey,verify as verifySignature,type JsonWebKey} from "node:crypto";
import {P4R28Denied} from "./p4-r28-ci-org-service.js";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";

export const CI_ISSUER="https://demo.us.auth0.com/";
export const CI_AUDIENCE="urn:zoho-clone:ci-only";
const denied=()=>{throw new P4R28Denied(401,"IDENTITY_REQUIRED");};
const BASE64URL=/^[A-Za-z0-9_-]+$/;
function decode(segment:string):unknown{
 if(!segment||segment.length>8192||!BASE64URL.test(segment))return denied();
 const bytes=Buffer.from(segment,"base64url");
 if(bytes.toString("base64url")!==segment)return denied();
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
 catch{return denied();}
}
type ObjectValue=Record<string,unknown>;
function plain(input:unknown):input is ObjectValue{
 return !!input&&typeof input==="object"&&!Array.isArray(input);
}
export type P4R33CiJwk=Readonly<{
 kty:"RSA";kid:string;alg:"RS256";use:"sig";n:string;e:string;
}>;
export type P4R33CiVerifiedIdentity=Readonly<{
 issuer:string;subject:string;emailVerified:true;
}>;
export function verifyP4R33CiToken(
 token:unknown,keys:readonly P4R33CiJwk[],nowSeconds:number,
 env:NodeJS.ProcessEnv=process.env,
):P4R33CiVerifiedIdentity{
 try{assertP4V1CiPrismaEnvironment(env);}catch{return denied();}
 if(typeof token!=="string"||token.length>10000||
  !Number.isSafeInteger(nowSeconds)||!Array.isArray(keys)||
  keys.length<1||keys.length>3)return denied();
 const parts=token.split(".");
 if(parts.length!==3||parts.some(p=>!p||!BASE64URL.test(p)))return denied();
 const header=decode(parts[0]!),payload=decode(parts[1]!);
 if(!plain(header)||!plain(payload)||
  Object.keys(header).sort().join(",")!=="alg,kid,typ"||
  header.alg!=="RS256"||header.typ!=="JWT"||
  typeof header.kid!=="string"||!/^r33-ci-key-[a-z0-9]{1,20}$/.test(header.kid))
  return denied();
 const matching=keys.filter(k=>k.kid===header.kid);
 if(matching.length!==1)return denied();
 const jwk=matching[0]!;
 if(jwk.kty!=="RSA"||jwk.alg!=="RS256"||jwk.use!=="sig"||
  typeof jwk.n!=="string"||typeof jwk.e!=="string")return denied();
 const aud=payload.aud;
 const audience=typeof aud==="string"?[aud]:aud;
 if(payload.iss!==CI_ISSUER||
  typeof payload.sub!=="string"||
  !/^auth0\|user_demo_[a-z]{3,16}$/.test(payload.sub)||
  !Array.isArray(audience)||audience.length!==1||
  audience[0]!==CI_AUDIENCE||
  payload.email_verified!==true||
  !Number.isSafeInteger(payload.exp)||
  !Number.isSafeInteger(payload.iat)||
  (payload.nbf!==undefined&&!Number.isSafeInteger(payload.nbf))||
  (payload.exp as number)<=nowSeconds||
  (payload.exp as number)>(nowSeconds+600)||
  (payload.iat as number)>(nowSeconds+30)||
  (payload.exp as number)<=(payload.iat as number)||
  (payload.nbf!==undefined&&(payload.nbf as number)>nowSeconds)||
  (payload.iat as number)<nowSeconds-3600)
  return denied();
 let verified=false;
 try{
  const key=createPublicKey({key:jwk as JsonWebKey,format:"jwk"});
  if(key.asymmetricKeyType!=="rsa"||!key.asymmetricKeyDetails||
    (key.asymmetricKeyDetails.modulusLength??0)<2048)return denied();
  const signature=Buffer.from(parts[2]!,"base64url");
  if(signature.toString("base64url")!==parts[2])return denied();
  verified=verifySignature("RSA-SHA256",
   Buffer.from(parts[0]+"."+parts[1],"ascii"),key,signature);
 }catch{return denied();}
 if(!verified)return denied();
 return Object.freeze({issuer:CI_ISSUER,subject:payload.sub,emailVerified:true});
}

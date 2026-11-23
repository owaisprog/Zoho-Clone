import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
import {verifyP4R33CiToken,CI_AUDIENCE,CI_ISSUER,type P4R33CiJwk}
 from "../src/platform/p4-r33-ci-jwt-verifier.js";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
 PGPASSWORD:"fake_ci_not_for_real_accounts"};
const NOW=2_000_000_000;
const keys=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk={...keys.publicKey.export({format:"jwk"}),kid:"r33-ci-key-one",
 alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
const header={alg:"RS256",typ:"JWT",kid:jwk.kid};
const claims={iss:CI_ISSUER,aud:CI_AUDIENCE,
 sub:"auth0|user_demo_carla",iat:NOW-10,exp:NOW+300,
 email_verified:true};
const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
const token=(h:unknown=header,p:unknown=claims,changeSignature=false)=>{
 const input=encode(h)+"."+encode(p);
 const s=sign("RSA-SHA256",Buffer.from(input),keys.privateKey);
 if(changeSignature)s[0]=(s[0]??0)^1;
 return input+"."+s.toString("base64url");
};
const denied=(raw:unknown,keyset:readonly P4R33CiJwk[]=[jwk],
 now=NOW,env:NodeJS.ProcessEnv=ENV)=>{
 assert.throws(()=>verifyP4R33CiToken(raw,keyset,now,env),
  e=>e instanceof P4R28Denied&&e.status===401);
};
describe("P4 R33 real RS256 verification with pinned fictional JWK",()=>{
 it("accepts valid RSA signature and verified fictional audience",()=>{
  assert.deepEqual(verifyP4R33CiToken(token(),[jwk],NOW,ENV),{
   issuer:CI_ISSUER,subject:"auth0|user_demo_carla",emailVerified:true,
  });
 });
 it("rejects forged signatures and modified claims",()=>{
  denied(token(header,claims,true));
  const forged=token().split(".");
  forged[1]=encode({...claims,sub:"auth0|user_demo_alice"});
  denied(forged.join("."));
 });
 it("rejects algorithm confusion or unsigned JWT",()=>{
  denied(token({...header,alg:"none"}));
  denied(token({...header,alg:"HS256"}));
  denied(encode({...header,alg:"none"})+"."+encode(claims)+".");
  denied(token({...header,role:"OWNER"}));
 });
 it("rejects unknown kid, multiple matching keys and wrong RSA algorithm",()=>{
  denied(token({...header,kid:"r33-ci-key-other"}));
  denied(token(),[]);
  denied(token(),[jwk,jwk]);
  denied(token(),[{...jwk,alg:"HS256" as never}]);
 });
 it("rejects issuer, audience, subject and email-verification mismatches",()=>{
  for(const p of [{...claims,iss:"https://evil.example.com/"},
   {...claims,aud:"urn:wrong"},
   {...claims,sub:"auth0|user_demo_unknown/extra"},
   {...claims,email_verified:false},
   {...claims,aud:[CI_AUDIENCE,"urn:extra"]}]){
   denied(token(header,p));
  }
 });
 it("rejects expired, immature, long TTL and future issued-at",()=>{
  for(const p of [{...claims,exp:NOW},
   {...claims,nbf:NOW+60},
   {...claims,iat:NOW+60},
   {...claims,exp:NOW+601},
   {...claims,iat:NOW-4000},
   {...claims,exp:NOW-100}]){
   denied(token(header,p));
  }
 });
 it("rejects noncanonical encoding and malformed JWT structure",()=>{
  for(const raw of ["",null,"a.b.c","bad","abc.def.ghi.jkl",
   token()+" ","Bearer "+token()]){
   denied(raw);
  }
 });
 it("rejects production and any non-disposable environment",()=>{
  for(const env of [{...ENV,NODE_ENV:"production"},
   {...ENV,PGHOST:"neon.tech"},{...ENV,CI:"false"}]){
   denied(token(),[jwk],NOW,env);
  }
 });
});

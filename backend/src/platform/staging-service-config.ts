/** Offline staging configuration boundary; no SDK connection or readiness claim. */
type Env=Readonly<Record<string,string|undefined>>;
export function readStageWorkerConfig(env:Env){
 // A durable BullMQ worker must not be started from a Vercel HTTP invocation.
 if(env.VERCEL==="1"||env.P4_STAGE_OWNER_ACTIVATION!=="approved"||
   env.P4_STAGE_SERVICE_PROFILE!=="isolated-staging-worker")return null;
 try{
  const url=new URL(env.P4_STAGE_REDIS_URL??"");
  if(url.protocol!=="rediss:"||url.hostname!==env.P4_STAGE_REDIS_HOST||
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(url.hostname)||
    !url.port||!url.password||url.search||url.hash||
    (url.pathname!==""&&url.pathname!=="/"&&url.pathname!=="/0"))return null;
  return {connection:{host:url.hostname,port:Number(url.port),username:decodeURIComponent(url.username)||"default",
    password:decodeURIComponent(url.password),tls:{servername:url.hostname,rejectUnauthorized:true},maxRetriesPerRequest:null},
    prefix:"zoho-clone-stage",queue:"platform-outbox-wake"};
 }catch{return null;}
}
export function readStagePrivateStorageTarget(env:Env){
 if(env.P4_STAGE_OWNER_ACTIVATION!=="approved"||env.P4_STAGE_STORAGE_ENABLED!=="true")return null;
 // Provider remains an owner decision. Only a separate private staging target is accepted.
 const provider=env.P4_STAGE_STORAGE_PROVIDER,bucket=env.P4_STAGE_STORAGE_BUCKET;
 if((provider!=="r2"&&provider!=="s3")||!bucket||!/^zoho-clone-staging-[a-z0-9-]{3,32}$/.test(bucket)||
    env.P4_STAGE_STORAGE_PUBLIC_ACCESS!=="blocked"||env.P4_STAGE_STORAGE_SCANNER!=="required")return null;
 return {provider,bucket,privateOnly:true as const,scannerRequired:true as const,ready:false as const};
}

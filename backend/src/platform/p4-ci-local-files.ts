/** Synthetic-only private local file lifecycle; not reachable from Express/Vercel. */
import {createHash,randomUUID} from "node:crypto";
import {mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

type Env=Readonly<Record<string,string|undefined>>;
export type ScanVerdict="clean"|"infected"|"unavailable";
export type LocalScanner=(bytes:Buffer)=>Promise<ScanVerdict>;
export type LocalFileArea="quarantine"|"clean";
export interface LocalObjectStore {
 put(area:LocalFileArea,id:string,bytes:Buffer):Promise<void>;
 read(area:LocalFileArea,id:string):Promise<Buffer>;
 close():Promise<void>;
}
type State="quarantined"|"clean"|"infected"|"unavailable";
const MAX=4096;
const deny=()=>{throw Error("P4_LOCAL_FILE_DENIED");};
const digest=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
export function requireLocalFileScope(env:Env){
 if(env.P4_LOCAL_FILES_ENABLED!=="true"||env.NODE_ENV==="production"||
    env.VERCEL!==undefined||env.VERCEL_ENV!==undefined||
    env.P4_STAGE_OWNER_ACTIVATION==="approved")return deny();
}
export function classifyClamScan(status:number|null,stdout:string):ScanVerdict{
 // clamscan reads stdin; only a single exact terminal verdict is accepted.
 const lines=stdout.trim().split(/\r?\n/).filter(Boolean);
 if(lines.length!==1)return "unavailable";
 if(status===0&&lines[0]==="stdin: OK")return "clean";
 if(status===1&&/^stdin: [A-Za-z0-9._-]{1,200} FOUND$/.test(lines[0]??""))return "infected";
 return "unavailable";
}
export class LocalPrivateFiles{
 private readonly files=new Map<string,{state:State;digest:string}>();
 private constructor(private readonly store:LocalObjectStore,private readonly scanner:LocalScanner,private readonly env:Env){}
 static createWithStore(store:LocalObjectStore,scanner:LocalScanner,env:Env){
  requireLocalFileScope(env);
  return new LocalPrivateFiles(store,scanner,env);
 }
 static async create(scanner:LocalScanner,env:Env){
  requireLocalFileScope(env);
  const root=await mkdtemp(join(tmpdir(),"zoho-local-files-"));
  try{
   await mkdir(join(root,"quarantine"),{mode:0o700});
   await mkdir(join(root,"clean"),{mode:0o700});
   return LocalPrivateFiles.createWithStore({
    async put(area,id,bytes){await writeFile(join(root,area,id),bytes,{mode:0o600,flag:"wx"});},
    read:(area,id)=>readFile(join(root,area,id)),
    async close(){await rm(root,{recursive:true,force:true});},
   },scanner,env);
  }catch{await rm(root,{recursive:true,force:true});return deny();}
 }
 async quarantine(bytes:Buffer){
  requireLocalFileScope(this.env);
  if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>MAX)return deny();
  const id=randomUUID(),snapshot=Buffer.from(bytes);
  await this.store.put("quarantine",id,snapshot);
  this.files.set(id,{state:"quarantined",digest:digest(snapshot)});
  return id;
 }
 async scan(id:string):Promise<State>{
  requireLocalFileScope(this.env);
  const record=this.files.get(id);
  if(!record||record.state!=="quarantined")return deny();
  // Mark before await to prevent concurrent releases of the same object.
  record.state="unavailable";
  try{
   const bytes=await this.store.read("quarantine",id);
   if(bytes.length>MAX||digest(bytes)!==record.digest)return record.state;
   const verdict=await this.scanner(Buffer.from(bytes));
   if(verdict==="infected"){record.state="infected";return record.state;}
   if(verdict!=="clean")return record.state;
   // Write the exact scanned snapshot, never reread an untrusted path for release.
   await this.store.put("clean",id,bytes);
   record.state="clean";
   return record.state;
  }catch{return record.state;}
 }
 async readClean(id:string){
  requireLocalFileScope(this.env);
  const record=this.files.get(id);
  if(!record||record.state!=="clean")return deny();
  const bytes=await this.store.read("clean",id);
  if(bytes.length>MAX||digest(bytes)!==record.digest)return deny();
  return bytes;
 }
 async close(){
  this.files.clear();
  await this.store.close();
 }
}

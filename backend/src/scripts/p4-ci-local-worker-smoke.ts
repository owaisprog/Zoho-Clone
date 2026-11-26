import {runLocalWorker} from "../platform/p4-ci-local-worker.js";
async function main(){
 const hardStop=setTimeout(()=>{console.error("P4_LOCAL_WORKER_TIMEOUT");process.exit(1);},22000);
 try{
  const result=await runLocalWorker();
  console.log("P4_LOCAL_WORKER_PASS",JSON.stringify(result));
 }finally{clearTimeout(hardStop);}
}
main().catch(()=>{console.error("P4_LOCAL_WORKER_FAIL");process.exitCode=1;});

import {runLocalWorker} from "../platform/p4-ci-local-worker.js";
async function main(){
 const hardStop=setTimeout(()=>{console.error("P4_LOCAL_WORKER_TIMEOUT");process.exit(1);},22000);
 try{
  const result=await runLocalWorker();
  console.log("P4_LOCAL_WORKER_PASS",JSON.stringify(result));
 }finally{clearTimeout(hardStop);}
}
main().catch((error:unknown)=>{
 const code=error instanceof Error?error.message:"";
 const safe=["P4_LOCAL_WORKER_DENIED","P4_LOCAL_WORKER_QUEUE_READY_FAILED","P4_LOCAL_WORKER_WORKER_READY_FAILED","P4_LOCAL_WORKER_ENQUEUE_FAILED","P4_LOCAL_WORKER_COMPLETION_FAILED","P4_LOCAL_WORKER_CLEANUP_FAILED","P4_LOCAL_WORKER_CLOSE_FAILED"];
 console.error(safe.includes(code)?code:"P4_LOCAL_WORKER_FAIL");process.exitCode=1;
});

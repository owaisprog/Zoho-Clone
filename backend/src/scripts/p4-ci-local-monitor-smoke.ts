import {createLocalMonitor} from "../platform/p4-ci-local-monitoring.js";
async function main(){
 const args=process.argv.slice(2);
 if(args.length>1||(args.length===1&&args[0]!=="--send-test"))throw Error("P4_LOCAL_MONITOR_DENIED");
 const monitor=createLocalMonitor(process.env);
 if(args[0]==="--send-test"){
  const result=await monitor.sendTest();
  console.log("P4_LOCAL_MONITOR_TEST",result);
  if(result!=="accepted")process.exitCode=1;
 }else{
  const result=await monitor.probe();
  console.log(JSON.stringify(result));
  if(result.status!=="passed")process.exitCode=1;
 }
}
main().catch(()=>{console.error("P4_LOCAL_MONITOR_DENIED");process.exitCode=1;});

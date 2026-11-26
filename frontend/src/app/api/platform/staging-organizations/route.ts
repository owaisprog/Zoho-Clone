import {NextResponse,type NextRequest} from "next/server";
import {auth0} from "@/lib/auth0";
import {listStageOrganizations} from "@/lib/staging-organization-directory";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const headers={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
 const keys=[...req.nextUrl.searchParams.keys()];
 if(req.headers.get("x-p4-membership-check")!=="1"||
    (req.headers.has("sec-fetch-site")&&req.headers.get("sec-fetch-site")!=="same-origin")||
    (keys.length!==0&&(keys.length!==1||keys[0]!=="after")))
  return NextResponse.json({status:"denied",applicationAccess:false},{status:403,headers});
 if(!auth0)return NextResponse.json({status:"disabled",applicationAccess:false},{status:503,headers});
 const client=auth0;
 const result=await listStageOrganizations(req.nextUrl.searchParams.get("after"),{
  hasSession:async()=>Boolean(await client.getSession()),getToken:async()=>(await client.getAccessToken()).token
 });
 return NextResponse.json(result,{headers,status:result.status==="verified"?200:result.status==="unauthenticated"?401:result.status==="denied"?403:503});
}

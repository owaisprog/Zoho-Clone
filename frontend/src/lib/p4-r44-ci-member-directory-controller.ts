/**
 * R44 disposable CI-only owner member directory interaction model.
 * Search/filter/revoke/refresh are real typed API calls in CI, not UI fixtures.
 */
import type {P4R41CiMemberRoleClient}
 from "./p4-r41-ci-member-role-client";
import type {P4R44CiDirectoryMember,P4R44CiFilter}
 from "./p4-r44-ci-member-directory-contract";
export type P4R44DirectoryView=Readonly<{
 phase:"idle"|"ready"|"updated"|"denied";
 filter:P4R44CiFilter;
 search:string;
 members:readonly P4R44CiDirectoryMember[];
 message:string;
}>;
const INITIAL:P4R44DirectoryView=Object.freeze({
 phase:"idle",filter:"all",search:"",members:Object.freeze([]),
 message:"CI member directory not loaded",
});
export class P4R44CiDirectoryController{
 private state:P4R44DirectoryView=INITIAL;
 constructor(private readonly api:Pick<P4R41CiMemberRoleClient,"directory"|"revoke">){}
 snapshot():P4R44DirectoryView{return this.state;}
 async refresh(orgId:string,filter:P4R44CiFilter,search:string):
  Promise<P4R44DirectoryView>{
  try{
   const members=await this.api.directory(orgId,filter,search);
   this.state=Object.freeze({
    phase:"ready",filter,search,members,
    message:"Fictional organization directory loaded from disposable PostgreSQL",
   });
  }catch{
   this.state=Object.freeze({
    phase:"denied",filter,search,members:Object.freeze([]),
    message:"Directory request denied. Previous member data cleared.",
   });
  }
  return this.state;
 }
 async revokeAndRefresh(orgId:string,userId:string):
  Promise<P4R44DirectoryView>{
  const {filter,search}=this.state;
  try{
   const result=await this.api.revoke(orgId,userId);
   if(result.revoked!==true)throw Error("INVALID_RESPONSE");
   const members=await this.api.directory(orgId,filter,search);
   this.state=Object.freeze({
    phase:"updated",filter,search,members,
    message:"Fictional member revoked; directory refreshed",
   });
  }catch{
   this.state=Object.freeze({
    phase:"denied",filter,search,members:Object.freeze([]),
    message:"Member change denied or refresh unavailable. Data cleared.",
   });
  }
  return this.state;
 }
 reset():void{this.state=INITIAL;}
}

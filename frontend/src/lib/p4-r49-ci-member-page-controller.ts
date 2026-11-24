/** R49 CI-only owner member list with safe page concatenation and clear-on-denial. */
import type {P4R44CiDirectoryMember,P4R44CiFilter}
 from "./p4-r44-ci-member-directory-contract";
import type {P4R49CiMemberPageClient}
 from "./p4-r49-ci-member-page-client";
export type P4R49View=Readonly<{
 phase:"idle"|"ready"|"denied";filter:P4R44CiFilter;search:string;
 members:readonly P4R44CiDirectoryMember[];nextCursor:string|null;
 message:string;
}>;
const INITIAL:P4R49View=Object.freeze({
 phase:"idle",filter:"all",search:"",members:Object.freeze([]),
 nextCursor:null,message:"CI-only member pages inactive",
});
export class P4R49CiMemberPageController{
 private state:P4R49View=INITIAL;
 constructor(private readonly api:Pick<P4R49CiMemberPageClient,"page">){}
 snapshot():P4R49View{return this.state;}
 private deny():P4R49View{
  this.state=Object.freeze({...this.state,phase:"denied",
   members:Object.freeze([]),nextCursor:null,
   message:"Member page denied; previous data cleared"});
  return this.state;
 }
 async refresh(org:string,filter:P4R44CiFilter,search:string):Promise<P4R49View>{
  this.state=Object.freeze({phase:"idle",filter,search,
   members:Object.freeze([]),nextCursor:null,message:"Loading owner member page"});
  try{
   const page=await this.api.page(org,filter,search,null);
   this.state=Object.freeze({...this.state,phase:"ready",
    members:page.items,nextCursor:page.nextCursor,
    message:"Fictional owner member page read from disposable PostgreSQL"});
   return this.state;
  }catch{return this.deny();}
 }
 async more(org:string):Promise<P4R49View>{
  if(this.state.phase!=="ready"||!this.state.nextCursor)return this.deny();
  try{
   const page=await this.api.page(org,this.state.filter,this.state.search,
    this.state.nextCursor);
   const merged=[...this.state.members,...page.items];
   if(new Set(merged.map(x=>x.userId)).size!==merged.length)
    return this.deny();
   this.state=Object.freeze({...this.state,phase:"ready",
    members:Object.freeze(merged),nextCursor:page.nextCursor,
    message:"Loaded next owner member page"});
   return this.state;
  }catch{return this.deny();}
 }
 reset(){this.state=INITIAL;}
}

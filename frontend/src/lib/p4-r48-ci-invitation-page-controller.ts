/** R48 owner paged invitation list; never caches token or raw identity. */
import type {SafeInvitationDraft} from "./p4-invitation-api-contract";
import type {P4R47CiInviteFilter} from "./p4-r47-ci-invitation-directory-client";
import type {P4R48CiInvitationPageClient}
 from "./p4-r48-ci-invitation-page-client";
export type P4R48View=Readonly<{
 phase:"idle"|"ready"|"denied";
 filter:P4R47CiInviteFilter;search:string;
 items:readonly SafeInvitationDraft[];nextCursor:string|null;
 message:string;
}>;
const INITIAL:P4R48View=Object.freeze({phase:"idle",filter:"all",search:"",
 items:Object.freeze([]),nextCursor:null,message:"CI-only invitation pages inactive"});
export class P4R48CiInvitationPageController{
 private state:P4R48View=INITIAL;
 constructor(private readonly api:Pick<P4R48CiInvitationPageClient,"page">){}
 snapshot():P4R48View{return this.state;}
 private denied():P4R48View{
  this.state=Object.freeze({...this.state,phase:"denied",
   items:Object.freeze([]),nextCursor:null,
   message:"Invitation pages denied; previous records cleared"});
  return this.state;
 }
 async refresh(org:string,filter:P4R47CiInviteFilter,search:string):Promise<P4R48View>{
  this.state=Object.freeze({phase:"idle",filter,search,
   items:Object.freeze([]),nextCursor:null,message:"Loading first CI page"});
  try{
   const result=await this.api.page(org,filter,search,null);
   this.state=Object.freeze({...this.state,phase:"ready",
    items:result.items,nextCursor:result.nextCursor,
    message:"Owner invitation first page read from disposable PostgreSQL"});
   return this.state;
  }catch{return this.denied();}
 }
 async more(org:string):Promise<P4R48View>{
  if(this.state.phase!=="ready"||!this.state.nextCursor)return this.denied();
  try{
   const page=await this.api.page(org,this.state.filter,this.state.search,
    this.state.nextCursor);
   const merged=[...this.state.items,...page.items];
   if(new Set(merged.map(x=>x.id)).size!==merged.length)
    return this.denied();
   this.state=Object.freeze({...this.state,phase:"ready",
    items:Object.freeze(merged),nextCursor:page.nextCursor,
    message:"Loaded next owner invitation page"});
   return this.state;
  }catch{return this.denied();}
 }
 reset(){this.state=INITIAL;}
}

/**
 * P4 R33 CI-only verified-JWT-to-database identity adapter.
 * Router is UNMOUNTED in backend/src/app.ts; never a live Auth0 JWKS client.
 */
import type pg from "pg";
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer} from "./p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService} from "./p4-r30-ci-invitation-acceptance.js";
import {createP4R32CiOutboxRouter} from "./p4-r32-ci-outbox-router.js";
import {createP4R30CiInvitationAcceptanceRouter}
 from "./p4-r30-ci-invitation-accept-router.js";
import {verifyP4R33CiToken,type P4R33CiJwk}
 from "./p4-r33-ci-jwt-verifier.js";
import {P4R40CiMemberRoles} from "./p4-r40-ci-member-roles.js";
import {createP4R40CiMemberRolesRouter}
 from "./p4-r40-ci-member-roles-router.js";
import {P4R43CiMemberRevokeService}
 from "./p4-r43-ci-member-revoke-service.js";
import {createP4R43CiMemberRevokeRouter}
 from "./p4-r43-ci-member-revoke-router.js";
import {P4R45CiRenewalIssuer} from "./p4-r45-ci-renewal-issuer.js";
import {createP4R45CiRenewalRouter} from "./p4-r45-ci-renewal-router.js";
import {P4R46CiInvitationCanceler} from "./p4-r46-ci-invitation-canceler.js";
import {createP4R46CiCancelRouter} from "./p4-r46-ci-invitation-cancel-router.js";
import {P4R47CiInvitationDirectory} from "./p4-r47-ci-invitation-directory.js";
import {createP4R47CiInvitationDirectoryRouter} from "./p4-r47-ci-invitation-directory-router.js";
import {P4R48CiInvitationPager} from "./p4-r48-ci-invitation-pager.js";
import {createP4R48CiInvitationPagerRouter}
 from "./p4-r48-ci-invitation-pager-router.js";
import {P4R49CiMemberPager} from "./p4-r49-ci-member-pager.js";
import {createP4R49CiMemberPagerRouter} from "./p4-r49-ci-member-pager-router.js";
import {P4R50CiOwnerOperations} from "./p4-r50-ci-owner-operations.js";
import {createP4R50CiOwnerOperationsRouter}
 from "./p4-r50-ci-owner-operations-router.js";
import {P4R51CiOwnerActivityService} from "./p4-r51-ci-owner-activity.js";
import {createP4R51CiOwnerActivityRouter} from "./p4-r51-ci-owner-activity-router.js";
import {P4R52CiOwnerActivityPager} from "./p4-r52-ci-owner-activity-pager.js";
import {createP4R52CiOwnerActivityPagerRouter}
 from "./p4-r52-ci-owner-activity-pager-router.js";
import {P4R54CiOwnedOrganizations} from "./p4-r54-ci-owned-organizations.js";
import {createP4R54CiOwnedOrganizationsRouter}
 from "./p4-r54-ci-owned-organizations-router.js";
import {P4R57CiCrmLeads} from "./p4-r57-ci-crm-leads.js";
import {createP4R57CiCrmLeadsRouter} from "./p4-r57-ci-crm-leads-router.js";
import {P4R58CiCrmLeadStages} from "./p4-r58-ci-crm-lead-stages.js";
import {createP4R58CiCrmLeadStagesRouter}
 from "./p4-r58-ci-crm-lead-stages-router.js";
import {P4R60CiCrmLeadPager} from "./p4-r60-ci-crm-lead-pager.js";
import {createP4R60CiCrmLeadPagerRouter}
 from "./p4-r60-ci-crm-lead-pager-router.js";
import {P4R61CiLeadNotes} from "./p4-r61-ci-lead-notes.js";
import {createP4R61CiLeadNotesRouter} from "./p4-r61-ci-lead-notes-router.js";
import {P4R63CiNotePager} from "./p4-r63-ci-note-pager.js";
import {createP4R63CiNotePagerRouter} from "./p4-r63-ci-note-pager-router.js";
import {P4R64CiLeadTasks} from "./p4-r64-ci-lead-tasks.js";
import {createP4R64CiLeadTasksRouter} from "./p4-r64-ci-lead-tasks-router.js";
import {P4R66CiTaskPager} from "./p4-r66-ci-task-pager.js";
import {createP4R66CiTaskPagerRouter} from "./p4-r66-ci-task-pager-router.js";
const deny=()=>{throw new P4R28Denied(401,"IDENTITY_REQUIRED");};
export class P4R33CiActorMapper{
 constructor(private readonly pool:pg.Pool,
  private readonly keys:readonly P4R33CiJwk[],
  private readonly clock:()=>number,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async resolve(req:Request):Promise<P4R28Actor|null>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return deny();}
  const auth=req.header("authorization");
  if(typeof auth!=="string"||auth.length>10200||
   !/^Bearer [A-Za-z0-9._-]+$/.test(auth))return deny();
  const verified=verifyP4R33CiToken(auth.slice(7),this.keys,
   this.clock(),this.env);
  // The token is already RSA signature-checked. Only the DB maps the
  // signed provider sub to our internal fictional actor ID.
  try{
   const rows=await this.pool.query(
    "SELECT user_id,canonical_email,email_verified"+
    " FROM p4_synthetic.identity_subjects"+
    " WHERE issuer=$1 AND external_subject=$2 AND email_verified=true"+
    " LIMIT 2",[verified.issuer,verified.subject]);
   if(rows.rows.length!==1||rows.rows[0]?.email_verified!==true||
    typeof rows.rows[0]?.user_id!=="string"||
    !/^user_demo_[a-z]{3,16}$/.test(rows.rows[0].user_id)||
    typeof rows.rows[0]?.canonical_email!=="string"||
    !/^[a-z0-9._-]+@example\.com$/.test(rows.rows[0].canonical_email))
    return deny();
   return Object.freeze({userId:rows.rows[0].user_id,verified:true as const});
  }catch{return deny();}
 }
}
export function createP4R33CiVerifiedWorkflowRouter(deps:{
 mapper:P4R33CiActorMapper;
 issuer:P4R32CiOutboxIssuer;
 acceptance:P4R30CiAcceptanceService;
 roles?:P4R40CiMemberRoles;
 revoker?:P4R43CiMemberRevokeService;
 renewer?:P4R45CiRenewalIssuer;
 canceler?:P4R46CiInvitationCanceler;
 invitations?:P4R47CiInvitationDirectory;
 invitationPages?:P4R48CiInvitationPager;
 memberPages?:P4R49CiMemberPager;
 ownerSummary?:P4R50CiOwnerOperations;
 ownerActivity?:P4R51CiOwnerActivityService;
 ownerActivityPages?:P4R52CiOwnerActivityPager;
 ownerOrganizations?:P4R54CiOwnedOrganizations;
 crmLeads?:P4R57CiCrmLeads;
 crmLeadStages?:P4R58CiCrmLeadStages;
 crmLeadPages?:P4R60CiCrmLeadPager;
 crmLeadNotes?:P4R61CiLeadNotes;
 crmNotePages?:P4R63CiNotePager;
 crmLeadTasks?:P4R64CiLeadTasks;
 crmTaskPages?:P4R66CiTaskPager;
},env:NodeJS.ProcessEnv=process.env):Router{
 assertP4V1CiPrismaEnvironment(env);
 if(env.NODE_ENV==="production"||!deps?.mapper||!deps.issuer||
  !deps.acceptance)throw Error("P4_R33_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 const resolve=(req:Request)=>deps.mapper.resolve(req);
 router.use("/owner",createP4R32CiOutboxRouter({
  issuer:deps.issuer,resolveVerifiedActor:resolve,
 }));
 if(deps.roles)router.use("/owner",createP4R40CiMemberRolesRouter({
  service:deps.roles,resolveVerifiedActor:resolve,
 },env));
 if(deps.revoker)router.use("/owner",createP4R43CiMemberRevokeRouter({
  service:deps.revoker,resolveVerifiedActor:resolve,
 },env));
 if(deps.renewer)router.use("/owner",createP4R45CiRenewalRouter({
  issuer:deps.renewer,resolveVerifiedActor:resolve,
 },env));
 if(deps.canceler)router.use("/owner",createP4R46CiCancelRouter({
  service:deps.canceler,resolveVerifiedActor:resolve,
 },env));
 if(deps.invitations)router.use("/owner",createP4R47CiInvitationDirectoryRouter({
  service:deps.invitations,resolveVerifiedActor:resolve,
 },env));
 if(deps.invitationPages)router.use("/owner",createP4R48CiInvitationPagerRouter({
  pager:deps.invitationPages,resolveVerifiedActor:resolve,
 },env));
 if(deps.memberPages)router.use("/owner",createP4R49CiMemberPagerRouter({
  pager:deps.memberPages,resolveVerifiedActor:resolve,
 },env));
 if(deps.ownerSummary)router.use("/owner",createP4R50CiOwnerOperationsRouter({
  service:deps.ownerSummary,resolveVerifiedActor:resolve,
 },env));
 if(deps.ownerActivity)router.use("/owner",createP4R51CiOwnerActivityRouter({
  service:deps.ownerActivity,resolveVerifiedActor:resolve,
 },env));
 if(deps.ownerActivityPages)router.use("/owner",createP4R52CiOwnerActivityPagerRouter({
  pager:deps.ownerActivityPages,resolveVerifiedActor:resolve,
 },env));
 if(deps.ownerOrganizations)router.use("/owner",
  createP4R54CiOwnedOrganizationsRouter({
   service:deps.ownerOrganizations,resolveVerifiedActor:resolve,
  },env));
 if(deps.crmLeads)router.use("/owner",createP4R57CiCrmLeadsRouter({
  service:deps.crmLeads,resolveVerifiedActor:resolve,
 },env));
 if(deps.crmLeadStages)router.use("/owner",createP4R58CiCrmLeadStagesRouter({
  service:deps.crmLeadStages,resolveVerifiedActor:resolve,
 },env));
 if(deps.crmLeadPages)router.use("/owner",createP4R60CiCrmLeadPagerRouter({
  pager:deps.crmLeadPages,resolveVerifiedActor:resolve,
 },env));
 if(deps.crmLeadNotes)router.use("/owner",createP4R61CiLeadNotesRouter({
  service:deps.crmLeadNotes,resolveVerifiedActor:resolve,
 },env));
 if(deps.crmNotePages)router.use("/owner",createP4R63CiNotePagerRouter({
  pager:deps.crmNotePages,resolveVerifiedActor:resolve,
 },env));
 if(deps.crmLeadTasks)router.use("/owner",createP4R64CiLeadTasksRouter({
  service:deps.crmLeadTasks,resolveVerifiedActor:resolve,
 },env));
 if(deps.crmTaskPages)router.use("/owner",createP4R66CiTaskPagerRouter({
  pager:deps.crmTaskPages,resolveVerifiedActor:resolve,
 },env));
 router.use("/recipient",createP4R30CiInvitationAcceptanceRouter({
  service:deps.acceptance,resolveVerifiedActor:resolve,
 }));
 return router;
}

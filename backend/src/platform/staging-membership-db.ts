import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/p4-stage/client.js";
import { isCanonicalUuidV4 } from "./p4-approved-uuid.js";

export type StageMembership = Readonly<{ actorId: string; organizationId: string; role: "OWNER" | "MEMBER" }>;
export type StageIdentity = Readonly<{ issuer: string; subject: string }>;
export type StageMembershipReader = { read(identity: StageIdentity, organizationId: string): Promise<StageMembership | null> };
export class PrismaStageMembershipReader implements StageMembershipReader {
  constructor(private readonly prisma: PrismaClient, private readonly database: "zoho_clone_staging" | "zoho_clone_synthetic_ci") {}
  async read(identity: StageIdentity, organizationId: string): Promise<StageMembership | null> {
    if (!isCanonicalUuidV4(organizationId) ||
      !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com\/$/.test(identity.issuer) ||
      !/^auth0\|[A-Za-z0-9_-]{3,180}$/.test(identity.subject)) return null;
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const scope = await tx.$queryRaw<Array<{ valid: boolean }>>`
          SELECT current_user = 'p4_stage_runtime' AND session_user = current_user
            AND current_database() = ${this.database}
            AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND
              NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication OR rolinherit))
            AND NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user)
            AND NOT has_schema_privilege(current_user,'platform_stage','CREATE')
            AND (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='platform_stage' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
                AND c.relname IN ('users','identity_subjects','organizations','memberships')
                AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
                AND NOT has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
                AND NOT has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER'))=4 AS valid
        `;
        if(scope.length!==1||scope[0]?.valid!==true) throw Error("ROLE_DENIED");
        const rows=await tx.$queryRaw<Array<StageMembership>>`
          SELECT actor_id::text AS "actorId",organization_id::text AS "organizationId",membership_role AS role
          FROM platform_stage.membership_check(${identity.issuer},${identity.subject},${organizationId}::uuid)
        `;
        if(rows.length===0)return null;
        const r=rows[0];
        if(rows.length!==1||!r||!isCanonicalUuidV4(r.actorId)||r.organizationId!==organizationId||
          (r.role!=="OWNER"&&r.role!=="MEMBER"))throw Error("PROJECTION_DENIED");
        return Object.freeze({actorId:r.actorId,organizationId:r.organizationId,role:r.role});
      },{isolationLevel:"RepeatableRead",maxWait:3000,timeout:5000});
    } catch { throw Error("P4_STAGE_MEMBERSHIP_UNAVAILABLE"); }
  }
}
export function readStageDatabaseUrl(env:Readonly<Record<string,string|undefined>>): string | null {
  if(env.VERCEL!=="1"||env.VERCEL_ENV!=="preview"||env.P4_VERCEL_SYNTHETIC_PREVIEW!=="true"||
    env.P4_STAGE_MEMBERSHIP_ENABLED!=="true")return null;
  try {
    const url=new URL(env.P4_STAGE_DATABASE_URL??"");
    if(url.protocol!=="postgresql:"||url.hostname!==env.P4_STAGE_DATABASE_HOST||
      !/^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech$/.test(url.hostname)||
      url.username!=="p4_stage_runtime"||!url.password||url.pathname!=="/zoho_clone_staging"||
      url.port||url.hash||url.searchParams.size!==1||url.searchParams.get("sslmode")!=="verify-full")return null;
    return url.toString();
  }catch{return null;}
}
/** Caller must separately approve external staging activation. No connection is made at import. */
export function createStageDatabaseReader(env:Readonly<Record<string,string|undefined>>=process.env){
  const connectionString=readStageDatabaseUrl(env);
  if(!connectionString)return null;
  const prisma=new PrismaClient({adapter:new PrismaPg({connectionString,max:1,connectionTimeoutMillis:3000,statement_timeout:3000})});
  return {reader:new PrismaStageMembershipReader(prisma,"zoho_clone_staging"),close:()=>prisma.$disconnect()};
}

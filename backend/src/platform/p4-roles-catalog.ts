/**
 * P4.12 provisional role templates. This is a fixed synthetic allowlist,
 * not a production role editor or an authorization-bearing JWT claim.
 * Owner status never bypasses organization, row or field policies.
 */
export const P4_PERMISSION_CODES = [
  "org.members.read", "org.members.manage",
  "crm.leads.read.own", "crm.leads.read.all", "crm.leads.edit.own",
  "teams.read.assigned", "teams.manage.assigned",
] as const;
export type P4PermissionCode = (typeof P4_PERMISSION_CODES)[number];
export type ReservedRoleCode = "OWNER" | "MEMBER";
export interface P4RoleDefinition {
  code: string;
  label: string;
  reserved: boolean;
  permissions: readonly P4PermissionCode[];
}
const ALLOWED_CODES: ReadonlySet<string> = new Set(P4_PERMISSION_CODES);
const RESERVED: Readonly<Record<ReservedRoleCode, P4RoleDefinition>> = Object.freeze({
  OWNER: Object.freeze({
    code: "OWNER", label: "Organization owner (fictional)", reserved: true,
    permissions: Object.freeze([...P4_PERMISSION_CODES]),
  }),
  MEMBER: Object.freeze({
    code: "MEMBER", label: "Organization member (fictional)", reserved: true,
    permissions: Object.freeze(["crm.leads.read.own", "teams.read.assigned"] as const),
  }),
});
/** Review custom privileges per P1.06 before enabling real writes. */
const CUSTOM_ALLOWED: ReadonlySet<string> = new Set([
  "org.members.read", "crm.leads.read.own", "teams.read.assigned",
]);

export class P4RoleDefinitionDeniedError extends Error {
  constructor() { super("P4_ROLE_DEFINITION_DENIED"); }
}

export function reservedRole(code: unknown): P4RoleDefinition | null {
  if (code !== "OWNER" && code !== "MEMBER") return null;
  return RESERVED[code];
}

/** Validates a draft; no custom role is persisted or actually granted. */
export function validateSyntheticCustomRoleDraft(input: unknown): P4RoleDefinition {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new P4RoleDefinitionDeniedError();
  }
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== "code,label,permissions" ||
      typeof raw.code !== "string" ||
      !/^demo_[a-z][a-z0-9_]{2,30}$/.test(raw.code) ||
      typeof raw.label !== "string" ||
      !/^Demo [A-Za-z0-9 &'-]{3,40}$/.test(raw.label) ||
      !Array.isArray(raw.permissions) ||
      raw.permissions.length < 1 || raw.permissions.length > CUSTOM_ALLOWED.size) {
    throw new P4RoleDefinitionDeniedError();
  }
  const unique = new Set<string>();
  for (const permission of raw.permissions) {
    if (typeof permission !== "string" || !CUSTOM_ALLOWED.has(permission) ||
        !ALLOWED_CODES.has(permission) || unique.has(permission)) {
      throw new P4RoleDefinitionDeniedError();
    }
    unique.add(permission);
  }
  return Object.freeze({
    code: raw.code, label: raw.label, reserved: false,
    permissions: Object.freeze([...unique] as P4PermissionCode[]),
  });
}

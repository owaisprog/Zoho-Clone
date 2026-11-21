/**
 * GENERATED REVIEW BASELINE from docs/security/permission-matrix.csv
 * Existing owner-approved P1.06 DESIGN, 2026-11-13.
 * 13 role types x 22 resource families = 286 design decisions.
 * DO NOT edit this generated map directly or confuse with final P4 acceptance.
 * P4 Batch 07 evaluates only a safe subset of resource families with
 * currently available synthetic DB relationships; other actions remain DENIED.
 */
export const P4_R7_P106_ROW_COUNT = 286 as const;
export const P4_R7_P106_ROLES = ["ORG_OWNER","ORG_ADMIN","SALES_MANAGER","SALES_REP","ONBOARDING_MANAGER","ONBOARDING_COORDINATOR","AGENT_MANAGER","BILLING_ADMIN","SECURITY_REVIEWER","PLATFORM_SUPPORT","EXTERNAL_AGENT","EXTERNAL_MERCHANT","SYSTEM_WORKER"] as const;
export const P4_R7_P106_RESOURCES = ["organization","memberships","invitations","role_grants","app_entitlements","billing_reference","audit_events","leads","contacts","accounts","deals","tasks_activities","sales_reports","import_jobs","export_jobs","agents","merchants","merchant_applications","application_stage_history","application_checklists","external_status_reference","onboarding_dashboard"] as const;
export const P4_R7_P106_POLICY_ROWS = [
  {
    "resource": "organization",
    "release": "R0",
    "role": "ORG_OWNER",
    "actions": [
      "R",
      "U",
      "M"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "ORG_SAFE_METADATA",
    "conditions": "NO_DELETE_OR_SELF_CROSS_ORG"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "ORG_ADMIN",
    "actions": [
      "R",
      "U"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "ORG_PROFILE_ONLY",
    "conditions": "LEGAL_BILLING_SECURITY_OWNER_FIELDS_RESTRICTED"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "BILLING_ADMIN",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "ORG_BILLING_PROFILE_METADATA",
    "conditions": "NO_ORG_PROFILE_MODIFICATION"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "SECURITY_REVIEWER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "SAFE_ID_AND_POLICY_METADATA",
    "conditions": "NO_BUSINESS_CONTENT"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "organization",
    "release": "R0",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "ORG_OWNER",
    "actions": [
      "C",
      "R",
      "U",
      "M"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "SAFE_MEMBER_ID_ROLE_STATUS",
    "conditions": "CANNOT_REMOVE_LAST_OWNER_OR_ASSIGN_PLATFORM_ROLE"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "ORG_ADMIN",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "SAFE_MEMBER_ID_ROLE_STATUS",
    "conditions": "CANNOT_GRANT_OWNER_OR_PLATFORM_OR_SECURITY_REVIEWER_UNLESS_SEPARATE_POLICY"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "SECURITY_REVIEWER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "REDACTED_MEMBERSHIP_METADATA",
    "conditions": "NO_TOKEN_OR_CREDENTIAL"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "memberships",
    "release": "R0",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "ORG_OWNER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "INVITE_STATUS_EMAIL_ROLE_EXPIRY",
    "conditions": "TOKEN_PRIVATE_NEVER_LOGGED"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "ORG_ADMIN",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "INVITE_STATUS_EMAIL_ROLE_EXPIRY",
    "conditions": "ALLOWLIST_ROLES_ONLY"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "SECURITY_REVIEWER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "INVITE_AUDIT_METADATA_ONLY",
    "conditions": "MASK_EMAIL_IF_UNNECESSARY"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "invitations",
    "release": "R0",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "ORG_OWNER",
    "actions": [
      "R",
      "M"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "SAFE_ROLE_AND_GRANT_METADATA",
    "conditions": "NO_PLATFORM_ROLE_OR_SELF_PRIVILEGE_ESCALATION"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "ORG_ADMIN",
    "actions": [
      "R",
      "M"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "ASSIGNABLE_TEAM_ROLE_GRANTS",
    "conditions": "ALLOWLIST_NO_OWNER_SECURITY_OR_PLATFORM_ROLE"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "SECURITY_REVIEWER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "POLICY_METADATA_ONLY",
    "conditions": "NO_SELF_GRANT"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "role_grants",
    "release": "R0",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "ORG_OWNER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "PLAN_AND_APP_STATUS",
    "conditions": "SERVER_SOURCE_OF_TRUTH"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "ORG_ADMIN",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "PLAN_AND_APP_STATUS",
    "conditions": "SERVER_SOURCE_OF_TRUTH"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "BILLING_ADMIN",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "PLAN_AND_APP_STATUS",
    "conditions": "NO_UNVERIFIED_WEBHOOK"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "SECURITY_REVIEWER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "ENTITLEMENT_POLICY_METADATA",
    "conditions": "NO_PAYMENT_DETAILS"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "app_entitlements",
    "release": "R0",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "ORG_OWNER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "OPAQUE_PROVIDER_REF_STATUS",
    "conditions": "NO_RAW_BANK_OR_CARD"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "BILLING_ADMIN",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "OPAQUE_PROVIDER_REF_STATUS",
    "conditions": "HOSTED_ONLY_NO_LIVE_CHARGE_IN_SANDBOX"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "billing_reference",
    "release": "R0",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "ORG_OWNER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "SANITIZED_AUDIT_METADATA",
    "conditions": "NO_RAW_BODY_OR_SECRETS"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "SECURITY_REVIEWER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "SANITIZED_AUDIT_METADATA",
    "conditions": "AUDITED_REVIEW_ACCESS"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "audit_events",
    "release": "R0",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "SALES_MANAGER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "TEAM_RECORDS",
    "fieldScope": "ALLOWED_LEAD_FIELDS",
    "conditions": "TEAM_POLICY_CHECK"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "SALES_REP",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "OWN_OR_ASSIGNED_TEAM_RECORDS",
    "fieldScope": "ALLOWED_LEAD_FIELDS",
    "conditions": "NO_FOREIGN_ID_NO_HARD_DELETE"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "leads",
    "release": "R1",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "SALES_MANAGER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "TEAM_RECORDS",
    "fieldScope": "ALLOWED_CONTACT_FIELDS",
    "conditions": "NO_CROSS_TEAM_EXPORT_WITHOUT_E"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "SALES_REP",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "OWN_OR_ASSIGNED_TEAM_RECORDS",
    "fieldScope": "ALLOWED_CONTACT_FIELDS",
    "conditions": "NO_CROSS_TENANT_ASSOCIATION"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "contacts",
    "release": "R1",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "SALES_MANAGER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "TEAM_RECORDS",
    "fieldScope": "ALLOWED_ACCOUNT_FIELDS",
    "conditions": "SAME_TENANT_LINKS_ONLY"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "SALES_REP",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "OWN_OR_ASSIGNED_TEAM_RECORDS",
    "fieldScope": "ALLOWED_ACCOUNT_FIELDS",
    "conditions": "NO_GLOBAL_DEDUP_LEAK"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "ONBOARDING_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "SAFE_ACCOUNT_CONTEXT",
    "conditions": "NO_SALES_PRIVATE_NOTES"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [
      "R"
    ],
    "rowScope": "ASSIGNED_LINKED_RECORDS",
    "fieldScope": "SAFE_ACCOUNT_CONTEXT",
    "conditions": "NO_SALES_PRIVATE_NOTES"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "accounts",
    "release": "R1",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "SALES_MANAGER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "TEAM_RECORDS",
    "fieldScope": "ALLOWED_DEAL_FIELDS",
    "conditions": "APPROVED_PIPELINE_TRANSITIONS_ONLY"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "SALES_REP",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "OWN_OR_ASSIGNED_TEAM_RECORDS",
    "fieldScope": "ALLOWED_DEAL_FIELDS",
    "conditions": "STAGE_VERSION_CHECK"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "ONBOARDING_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "HANDOFF_SAFE_DEAL_CONTEXT",
    "conditions": "NO_UNAUTHORIZED_PRICE_NOTES"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [
      "R"
    ],
    "rowScope": "ASSIGNED_LINKED_RECORDS",
    "fieldScope": "HANDOFF_SAFE_DEAL_CONTEXT",
    "conditions": "DEAL_WON_NOT_EXTERNAL_APPROVAL"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "deals",
    "release": "R1",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "SALES_MANAGER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "TEAM_RECORDS",
    "fieldScope": "ALLOWED_TASK_FIELDS",
    "conditions": "ASSIGNEE_ACTIVE_MEMBER_ONLY"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "SALES_REP",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "OWN_OR_ASSIGNED_TEAM_RECORDS",
    "fieldScope": "ALLOWED_TASK_FIELDS",
    "conditions": "PARENT_RECORD_SCOPE_REQUIRED"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "ONBOARDING_MANAGER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "ALLOWED_TASK_FIELDS",
    "conditions": "PARENT_RECORD_SCOPE_REQUIRED"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "ASSIGNED_LINKED_RECORDS",
    "fieldScope": "ALLOWED_TASK_FIELDS",
    "conditions": "PARENT_RECORD_SCOPE_REQUIRED"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "tasks_activities",
    "release": "R1",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "SALES_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "TEAM_RECORDS",
    "fieldScope": "AUTHORIZED_AGGREGATES",
    "conditions": "FILTER_BEFORE_AGGREGATE"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "SALES_REP",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_OR_ASSIGNED_TEAM_RECORDS",
    "fieldScope": "AUTHORIZED_AGGREGATES",
    "conditions": "NO_HIDDEN_TEAM_COUNTS"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "sales_reports",
    "release": "R1",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "ORG_ADMIN",
    "actions": [
      "C",
      "R"
    ],
    "rowScope": "AUTHORIZED_TEAM_ONLY",
    "fieldScope": "IMPORT_JOB_METADATA",
    "conditions": "DELEGATED_DATA_IMPORT_GRANT_REQUIRED"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "SALES_MANAGER",
    "actions": [
      "C",
      "R"
    ],
    "rowScope": "TEAM_RECORDS",
    "fieldScope": "IMPORT_JOB_METADATA",
    "conditions": "DISABLED_UNTIL_ALLOWLIST_AND_SCAN_REQUIREMENTS_MET"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "import_jobs",
    "release": "R1",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "SALES_MANAGER",
    "actions": [
      "C",
      "R",
      "E"
    ],
    "rowScope": "TEAM_RECORDS",
    "fieldScope": "EXPORT_ALLOWED_FIELDS",
    "conditions": "SCOPED_TO_ACTUAL_RECORD_POLICY"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "SALES_REP",
    "actions": [
      "C",
      "R",
      "E"
    ],
    "rowScope": "OWN_OR_ASSIGNED_TEAM_RECORDS",
    "fieldScope": "EXPORT_ALLOWED_FIELDS",
    "conditions": "EXPLICIT_EXPORT_GRANT_REQUIRED"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "ONBOARDING_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "SECURITY_REVIEWER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "EXPORT_AUDIT_METADATA_ONLY",
    "conditions": "NO_EXPORTED_DATA_ACCESS"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "export_jobs",
    "release": "R1",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "ONBOARDING_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "TEAM_LINKED_AGENTS",
    "fieldScope": "AGENT_BUSINESS_METADATA",
    "conditions": "NO_EXTERNAL_PORTAL_ACCESS"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [
      "R"
    ],
    "rowScope": "ASSIGNED_LINKED_AGENTS",
    "fieldScope": "AGENT_DISPLAY_AND_REFERENCE",
    "conditions": "NO_PORTFOLIO_ENUMERATION"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "AGENT_MANAGER",
    "actions": [
      "C",
      "R",
      "U",
      "M"
    ],
    "rowScope": "ASSIGNED_AGENT_PORTFOLIO",
    "fieldScope": "AGENT_BUSINESS_METADATA",
    "conditions": "REASSIGNMENT_AUDITED"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "agents",
    "release": "R2",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "SALES_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "MERCHANT_HANDOFF_SUMMARY",
    "conditions": "NO_UNDERWRITING_OR_PRIVATE_DOCS"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "SALES_REP",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_OR_ASSIGNED_LINKED_RECORDS",
    "fieldScope": "MERCHANT_HANDOFF_SUMMARY",
    "conditions": "NO_UNDERWRITING_OR_PRIVATE_DOCS"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "ONBOARDING_MANAGER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "MERCHANT_SAFE_METADATA",
    "conditions": "NO_RAW_KYC_BANK_OR_CARD"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "ASSIGNED_LINKED_RECORDS",
    "fieldScope": "MERCHANT_SAFE_METADATA",
    "conditions": "NO_RAW_KYC_BANK_OR_CARD"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "AGENT_MANAGER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "ASSIGNED_AGENT_PORTFOLIO",
    "fieldScope": "MERCHANT_SAFE_METADATA",
    "conditions": "NO_RAW_KYC_BANK_OR_CARD"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "merchants",
    "release": "R2",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "SALES_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "HANDOFF_STATUS_SUMMARY",
    "conditions": "NO_DIRECT_CASE_UPDATE"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "SALES_REP",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_OR_ASSIGNED_LINKED_RECORDS",
    "fieldScope": "HANDOFF_STATUS_SUMMARY",
    "conditions": "NO_DIRECT_CASE_UPDATE"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "ONBOARDING_MANAGER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "INTERNAL_CASE_FIELDS",
    "conditions": "VALIDATED_STAGE_AND_VERSION"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "ASSIGNED_LINKED_RECORDS",
    "fieldScope": "INTERNAL_CASE_FIELDS",
    "conditions": "VALIDATED_STAGE_AND_VERSION"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "AGENT_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "ASSIGNED_AGENT_PORTFOLIO",
    "fieldScope": "AGENT_RELATED_CASE_SUMMARY",
    "conditions": "NO_EXT_STATUS_EDIT"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "merchant_applications",
    "release": "R2",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "ONBOARDING_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "SAFE_STAGE_HISTORY",
    "conditions": "APPEND_ONLY_VIA_AUTHORIZED_TRANSITION"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [
      "R"
    ],
    "rowScope": "ASSIGNED_LINKED_RECORDS",
    "fieldScope": "SAFE_STAGE_HISTORY",
    "conditions": "NO_DIRECT_CREATE_UPDATE_DELETE"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "AGENT_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "ASSIGNED_AGENT_PORTFOLIO",
    "fieldScope": "LIMITED_STAGE_AUDIT_SUMMARY",
    "conditions": "NO_DIRECT_STAGE_MUTATION"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "SECURITY_REVIEWER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "SANITIZED_TRANSITION_METADATA",
    "conditions": "NO_UNRESTRICTED_CASE_DETAIL"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "application_stage_history",
    "release": "R2",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "ONBOARDING_MANAGER",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "NON_SENSITIVE_CHECKLIST_FIELDS",
    "conditions": "CANNOT_CHANGE_EXTERNAL_PROCESSOR_STATUS"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [
      "C",
      "R",
      "U"
    ],
    "rowScope": "ASSIGNED_LINKED_RECORDS",
    "fieldScope": "NON_SENSITIVE_CHECKLIST_FIELDS",
    "conditions": "TEMPLATE_ALLOWLIST_ONLY"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "application_checklists",
    "release": "R2",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "ONBOARDING_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "SOURCE_TIMESTAMP_VERIFICATION_SUMMARY",
    "conditions": "READ_ONLY_NO_REAL_PROVIDER_IN_SANDBOX"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [
      "R"
    ],
    "rowScope": "ASSIGNED_LINKED_RECORDS",
    "fieldScope": "SOURCE_TIMESTAMP_VERIFICATION_SUMMARY",
    "conditions": "NEVER_TREAT_UNVERIFIED_AS_APPROVED"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "AGENT_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "SECURITY_REVIEWER",
    "actions": [
      "R"
    ],
    "rowScope": "OWN_ORG",
    "fieldScope": "SOURCE_PROVENANCE_METADATA_ONLY",
    "conditions": "NO_RAW_PROVIDER_EVENT_CONTENT"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "external_status_reference",
    "release": "R2",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "ORG_OWNER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "ORG_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "SALES_MANAGER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "SALES_REP",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "ONBOARDING_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "TEAM_LINKED_RECORDS",
    "fieldScope": "AUTHORIZED_AGGREGATES",
    "conditions": "ROW_FILTER_BEFORE_AGGREGATE"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "ONBOARDING_COORDINATOR",
    "actions": [
      "R"
    ],
    "rowScope": "ASSIGNED_LINKED_RECORDS",
    "fieldScope": "AUTHORIZED_AGGREGATES",
    "conditions": "NO_CROSS_AGENT_OR_TEAM_COUNTS"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "AGENT_MANAGER",
    "actions": [
      "R"
    ],
    "rowScope": "ASSIGNED_AGENT_PORTFOLIO",
    "fieldScope": "LIMITED_AGENT_PORTFOLIO_AGGREGATES",
    "conditions": "NO_ALL_TENANT_COUNTER"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "BILLING_ADMIN",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "SECURITY_REVIEWER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "PLATFORM_SUPPORT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFAULT_DENY"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "EXTERNAL_AGENT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "EXTERNAL_MERCHANT",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "DEFERRED_EXTERNAL_IDENTITY_NOT_LAUNCHED"
  },
  {
    "resource": "onboarding_dashboard",
    "release": "R2",
    "role": "SYSTEM_WORKER",
    "actions": [],
    "rowScope": "DENY",
    "fieldScope": "NONE",
    "conditions": "NO_DEFAULT_MACHINE_PRIVILEGE"
  }
] as const;

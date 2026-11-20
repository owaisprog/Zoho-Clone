/** Synthetic launcher: client display is NEVER API authorization. */
export type P4DemoAppCode = "crm" | "teams" | "finance" | "files";
export interface P4DemoNavigationItem {
  code: P4DemoAppCode;
  name: string;
  description: string;
  href: string;
  available: boolean;
}
export const P4_DEMO_APPS: readonly P4DemoNavigationItem[] = Object.freeze([
  Object.freeze({ code: "crm", name: "Sales CRM", description: "Fictional leads and sales activity",
    href: "/app/sales/leads", available: true }),
  Object.freeze({ code: "teams", name: "Team administration", description: "Fictional access and team permissions",
    href: "/app/organization/access", available: true }),
  Object.freeze({ code: "finance", name: "Finance", description: "Not enabled or billed in this demo",
    href: "/app/finance", available: false }),
  Object.freeze({ code: "files", name: "Files", description: "Upload provider and scanning not configured",
    href: "/app/files", available: false }),
]);
export function p4FilterDemoApps(query: unknown): readonly P4DemoNavigationItem[] {
  if (typeof query !== "string") return [];
  const value = query.toLowerCase().trim().slice(0, 80);
  return P4_DEMO_APPS.filter(item =>
    item.name.toLowerCase().includes(value) || item.description.toLowerCase().includes(value));
}
export function p4PreviewNavigationForRoute(route: unknown): P4DemoNavigationItem | null {
  if (typeof route !== "string") return null;
  const match = P4_DEMO_APPS.find(item => item.href === route && item.available === true);
  return match ? Object.freeze({ ...match }) : null;
}

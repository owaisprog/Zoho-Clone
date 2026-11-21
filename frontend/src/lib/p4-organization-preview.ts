/**
 * P4.05 fictional onboarding UI preview; no API call, no persistence,
 * no real owner or organization is created by this helper.
 */
export interface FictionalOrganizationPreview {
  name: string;
  slug: string;
  isValid: boolean;
}
export function fictionalOrganizationPreview(name: string, slug: string): FictionalOrganizationPreview {
  const normalizedName = name.trim();
  const normalizedSlug = slug.trim();
  const isValid = /^Demo [A-Za-z][A-Za-z0-9 &'-]{2,48}$/.test(normalizedName) &&
    normalizedName === name &&
    /^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug) &&
    normalizedSlug === slug &&
    normalizedSlug.length <= 48 &&
    !/^(?:demo-admin|demo-support|demo-system)$/.test(normalizedSlug);
  return { name: normalizedName, slug: normalizedSlug, isValid };
}
export function suggestFictionalSlug(name: string): string {
  const demoName = name.startsWith("Demo ") ? name.slice(5) : name;
  const token = demoName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 38).replace(/-+$/g, "");
  return token ? "demo-" + token : "demo-";
}

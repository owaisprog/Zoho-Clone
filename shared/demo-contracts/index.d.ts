export declare const DEMO_CONTRACT: "internal-fictional-v1";
export type LeadStage = "new" | "contacted" | "qualified";
export type ApplicationStage = "draft" | "needs_more_info" | "waiting_demo" | "handoff_pending" | "active_internal";
export interface DemoLead {
  id: string; organization: string; contact: string; email: string;
  stage: LeadStage; owner: string;
}
export interface DemoApplication {
  id: string; name: string; category: string; stage: ApplicationStage;
  owner: string; nextAction: string; updatedLabel: string;
}
export declare function isSyntheticLead(value: unknown): value is DemoLead;
export declare function isSyntheticApplication(value: unknown): value is DemoApplication;
export declare function parseSyntheticEnvelope<T extends DemoLead | DemoApplication>(
  payload: unknown, dataset: "leads" | "applications", expected: readonly T[]
): readonly T[] | null;

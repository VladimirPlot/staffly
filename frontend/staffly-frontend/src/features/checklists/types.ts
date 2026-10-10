import type { ChecklistItemDto } from "./api";

export type ChecklistTab = "checklists" | "scripts";
export type ChecklistViewScope = "my" | "all";

export type PhotoPreview = {
  title: string;
  url: string;
  description?: string;
  source?:
    | { kind: "current"; checklistId: number; itemId: number; photo: "example" | "completion" }
    | { kind: "history"; itemId: number; photo: "example" | "completion" };
};

export type ChecklistItemSectionKey = "available" | "reserved" | "done";
export type ChecklistWorkStatus = "empty" | "completed" | "reserved" | "available";
export type ChecklistItemGroups = Record<ChecklistItemSectionKey, ChecklistItemDto[]>;

export type ChecklistWorkSummary = {
  label: string;
  detail: string;
  status: ChecklistWorkStatus;
  badgeClassName: string;
};

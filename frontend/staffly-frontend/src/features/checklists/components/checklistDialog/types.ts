import type { ChecklistKind, ChecklistPeriodicity, ChecklistPhotoMode, ChecklistRequest } from "../../api";

export type PositionField = { id: string; value: number | "" };

export type ChecklistItemField = {
  clientId: string;
  id?: number;
  value: string;
  completionPhotoMode: ChecklistPhotoMode;
  examplePhotoUrl?: string | null;
  exampleFile?: File;
  examplePreviewUrl?: string;
  removeExamplePhoto?: boolean;
};

export type ChecklistDialogInitial = {
  kind: ChecklistKind;
  name: string;
  content?: string;
  positionIds: number[];
  periodicity?: ChecklistPeriodicity;
  resetTime?: string;
  resetDayOfWeek?: number;
  resetDayOfMonth?: number;
  items?: Array<{
    id?: number;
    text: string;
    completionPhotoMode?: ChecklistPhotoMode | null;
    completionPhotoRequired: boolean;
    examplePhotoUrl?: string | null;
  }>;
};

export type ChecklistDialogSubmitPayload = ChecklistRequest & {
  exampleFiles?: Array<{ index: number; file: File }>;
  examplePhotoDeletes?: number[];
};

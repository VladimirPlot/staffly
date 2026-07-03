import api from "../../shared/api/apiClient";
import type {
  ScheduleCellSource,
  ScheduleConfig,
  ScheduleData,
  ScheduleDay,
  ScheduleOwnerDto,
  ScheduleCreatedByDto,
  ScheduleAuditLogDto,
  ScheduleLifecycleFields,
  ScheduleStatus,
} from "./types";

export type ShiftRequestType = "REPLACEMENT" | "SWAP";
export type ShiftRequestStatus = "PENDING_MANAGER" | "APPROVED" | "REJECTED_BY_MANAGER";

export type ShiftRequestMemberDto = {
  id: number;
  displayName: string;
  positionName: string | null;
};

export type ShiftRequestDto = {
  id: number;
  type: ShiftRequestType;
  dayFrom: string;
  dayTo: string | null;
  status: ShiftRequestStatus;
  reason: string | null;
  createdAt: string;
  decidedAt?: string | null;
  decisionComment?: string | null;
  fromMember: ShiftRequestMemberDto;
  toMember: ShiftRequestMemberDto;
};

export type ScheduleLifecycleDto = ScheduleLifecycleFields;

export type ScheduleSummary = ScheduleLifecycleDto & {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  hasPendingShiftRequests: boolean;
  positionIds: number[];
  owner?: ScheduleOwnerDto | null;
  preferenceSubmittedCount?: number | null;
  preferenceTotalParticipants?: number | null;
  myPreferenceSubmitted?: boolean | null;
};

export type ScheduleSummaryDto = ScheduleSummary;

type ScheduleRowResponse = {
  id: number;
  memberId: number;
  displayName: string;
  positionId: number | null;
  positionName: string | null;
};

type ScheduleResponse = ScheduleLifecycleDto & {
  id: number;
  title: string;
  config: ScheduleConfig;
  days: ScheduleData["days"];
  rows: ScheduleRowResponse[];
  cellValues: Record<string, string>;
  cellSources?: Record<string, ScheduleCellSource>;
  owner?: ScheduleOwnerDto | null;
  createdBy?: ScheduleCreatedByDto | null;
  history?: ScheduleAuditLogDto[];
};

export type ScheduleDto = Omit<ScheduleData, "id" | "status"> &
  ScheduleLifecycleDto & {
    id: number;
  };

export type SaveSchedulePayload = {
  title: string;
  config: ScheduleConfig;
  rows: {
    memberId: number;
    displayName: string;
    positionId: number | null;
    positionName: string | null;
  }[];
  cellValues: Record<string, string>;
  cellSources?: Record<string, ScheduleCellSource>;
};

export type CreateDraftScheduleRequest = SaveSchedulePayload;

export type StartPreferenceCollectionRequest = {
  preferenceDeadline: string;
  buildTemplateId?: number | null;
};

export type SchedulePreferenceType = "AVAILABLE" | "UNAVAILABLE" | "PREFER_DAY_OFF";

export type SchedulePreferenceCellDto = {
  id: number | null;
  day: string;
  type: SchedulePreferenceType;
  fullDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
  sortOrder: number;
};

export type SchedulePreferenceCellRequest = {
  day: string;
  type: SchedulePreferenceType;
  fullDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
};

export type SchedulePreferenceMemberDto = {
  memberId: number;
  userId?: number | null;
  displayName?: string | null;
  positionId?: number | null;
  positionName?: string | null;
};

export type SchedulePreferenceAllowedShiftOptionDto = {
  id: number;
  label?: string | null;
  startTime: string;
  endTime: string;
};

export type SchedulePreferenceMyResponse = {
  scheduleId: number;
  title: string;
  startDate: string;
  endDate: string;
  days: ScheduleDay[];
  status: ScheduleStatus;
  preferenceDeadline?: string | null;
  canSubmit: boolean;
  submittedAt?: string | null;
  updatedAt?: string | null;
  revision: number;
  member: SchedulePreferenceMemberDto;
  allowedShiftOptions: SchedulePreferenceAllowedShiftOptionDto[];
  cells: SchedulePreferenceCellDto[];
  comment?: string | null;
  periodComment?: string | null;
};

export type SchedulePreferenceParticipantDto = {
  memberId: number;
  userId?: number | null;
  displayName?: string | null;
  positionId?: number | null;
  positionName?: string | null;
  submitted: boolean;
  submittedAt?: string | null;
  updatedAt?: string | null;
  revision: number;
  cellsCount: number;
};

export type SchedulePreferenceProgressResponse = {
  scheduleId: number;
  title: string;
  status: ScheduleStatus;
  preferenceDeadline?: string | null;
  totalParticipants: number;
  submittedCount: number;
  notSubmittedCount: number;
  participants: SchedulePreferenceParticipantDto[];
};

export type SchedulePreferenceSubmissionDto = {
  submissionId: number;
  member: SchedulePreferenceMemberDto;
  positionId?: number | null;
  positionName?: string | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
  revision: number;
  comment?: string | null;
  periodComment?: string | null;
  cells: SchedulePreferenceCellDto[];
};

export type SchedulePreferenceSubmissionsResponse = {
  scheduleId: number;
  title: string;
  status: ScheduleStatus;
  preferenceDeadline?: string | null;
  submissions: SchedulePreferenceSubmissionDto[];
};

export type UpsertMySchedulePreferenceRequest = {
  cells: SchedulePreferenceCellRequest[];
  comment?: string | null;
  periodComment?: string | null;
};
export type ScheduleBuildTargetPattern = "NONE" | "TWO_TWO" | "THREE_THREE" | "FIVE_TWO";

export type ScheduleBuildShiftOptionDto = {
  id: number;
  startTime: string;
  endTime: string;
  label: string | null;
  isFullShift: boolean;
  sortOrder: number;
};

export type ScheduleBuildCoverageRuleDto = {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  requiredCount: number;
  sortOrder: number;
};

export type ScheduleBuildMinRestMode = "SOFT" | "STRICT";

export type ScheduleBuildPositionConfigDto = {
  id: number;
  positionId: number;
  positionName: string;
  fullShiftStart: string;
  fullShiftEnd: string;
  targetPattern: ScheduleBuildTargetPattern;
  minRestHours: number | null;
  minRestMode: ScheduleBuildMinRestMode;
  maxShiftsPerPeriod: number | null;
  heavyDaysOfWeek: number[];
  shiftOptions: ScheduleBuildShiftOptionDto[];
  coverageRules: ScheduleBuildCoverageRuleDto[];
  sortOrder: number;
};

export type ScheduleBuildTemplateDto = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  positionConfigs: ScheduleBuildPositionConfigDto[];
};

export type SaveScheduleBuildShiftOptionRequest = {
  id?: number;
  startTime: string;
  endTime: string;
  label?: string | null;
  isFullShift: boolean;
  sortOrder: number;
};

export type SaveScheduleBuildCoverageRuleRequest = {
  id?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  requiredCount: number;
  sortOrder: number;
};

export type SaveScheduleBuildPositionConfigRequest = {
  id?: number;
  positionId: number;
  fullShiftStart: string;
  fullShiftEnd: string;
  targetPattern: ScheduleBuildTargetPattern;
  minRestHours?: number | null;
  minRestMode?: ScheduleBuildMinRestMode | null;
  maxShiftsPerPeriod?: number | null;
  heavyDaysOfWeek?: number[];
  shiftOptions: SaveScheduleBuildShiftOptionRequest[];
  coverageRules: SaveScheduleBuildCoverageRuleRequest[];
  sortOrder: number;
};

export type PreviewScheduleAutoBuildRequest = {
  templateId: number;
};

export type AdjustedScheduleAutoBuildAssignment = {
  memberId: number;
  memberName?: string | null;
  positionId: number;
  day: string;
  value?: string | null;
  shiftOptionId?: number | null;
  shiftLabel?: string | null;
  startTime: string;
  endTime: string;
  reason?: string | null;
  matchStatus?: ScheduleAutoBuildMatchStatus;
  warningMessage?: string | null;
};

export type ApplyScheduleAutoBuildRequest = {
  templateId: number;
  adjustedAssignments?: AdjustedScheduleAutoBuildAssignment[];
};

export type ScheduleAutoBuildMatchStatus =
  | "EXACT_INTERVAL_PREFERENCE"
  | "COVERING_INTERVAL_PREFERENCE"
  | "FULL_DAY_POSITIVE"
  | "NO_PREFERENCE"
  | "PARTIAL_INTERVAL_FALLBACK"
  | "SOFT_NEGATIVE_FALLBACK"
  | "HARD_NEGATIVE_FALLBACK"
  | "MANUAL_OVERRIDE";

export type ScheduleAutoBuildCellPreviewDto = {
  memberId: number | null;
  memberName: string | null;
  day: string;
  value: string | null;
  shiftOptionId: number | null;
  shiftLabel: string | null;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  matchStatus: ScheduleAutoBuildMatchStatus;
  warningMessage: string | null;
  warnings: string[];
};

export type ScheduleAutoBuildPositionPreviewDto = {
  positionId: number;
  positionName: string;
  cells: ScheduleAutoBuildCellPreviewDto[];
  warnings: string[];
  totalAssignments: number;
  warningsCount: number;
  unfilledCount: number;
  negativeAssignmentsCount: number;
};

export type ScheduleAutoBuildUncoveredSlotDto = {
  date: string;
  positionId: number;
  startTime: string;
  endTime: string;
  requiredCount: number;
  assignedCount: number;
};

export type ScheduleAutoBuildRejectionHintDto = {
  memberId: number;
  memberName?: string | null;
  date: string;
  positionId: number;
  positionName?: string | null;
  shiftOptionId?: number | null;
  shiftLabel?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  reason: "MAX_SHIFTS_LIMIT";
  message: string;
};

export type ScheduleAutoBuildPreviewResponse = {
  scheduleId: number;
  templateId: number;
  effectiveBuildTemplateId?: number | null;
  templateName: string;
  positions: ScheduleAutoBuildPositionPreviewDto[];
  warnings: string[];
  uncoveredSlots: ScheduleAutoBuildUncoveredSlotDto[];
  rejectionHints: ScheduleAutoBuildRejectionHintDto[];
  totalAssignments: number;
  warningsCount: number;
  unfilledCount: number;
  negativeAssignmentsCount: number;
};

export type SaveScheduleBuildTemplateRequest = {
  name: string;
  description?: string | null;
  positionConfigs: SaveScheduleBuildPositionConfigRequest[];
};

function nullableTimestamp(value: string | null | undefined): string | null {
  return value ?? null;
}

function mapLifecycle(data: ScheduleLifecycleDto): ScheduleLifecycleDto {
  return {
    status: data.status,
    preferenceCollectionStartedAt: nullableTimestamp(data.preferenceCollectionStartedAt),
    preferenceDeadline: nullableTimestamp(data.preferenceDeadline),
    preferenceClosedAt: nullableTimestamp(data.preferenceClosedAt),
    preferenceAppliedAt: nullableTimestamp(data.preferenceAppliedAt),
    preferenceBuildTemplateId: data.preferenceBuildTemplateId ?? null,
  };
}

function mapSchedule(data: ScheduleResponse): ScheduleData {
  return {
    id: data.id,
    ...mapLifecycle(data),
    title: data.title,
    config: data.config,
    days: data.days ?? [],
    rows: (data.rows ?? []).map((row) => ({
      id: row.id,
      memberId: row.memberId,
      displayName: row.displayName,
      positionId: row.positionId,
      positionName: row.positionName,
    })),
    cellValues: data.cellValues ?? {},
    cellSources: data.cellSources ?? {},
    owner: data.owner ?? null,
    createdBy: data.createdBy ?? null,
    history: data.history ?? [],
  };
}

function mapScheduleSummary(data: ScheduleSummary): ScheduleSummary {
  return {
    ...data,
    ...mapLifecycle(data),
    positionIds: data.positionIds ?? [],
    owner: data.owner ?? null,
    preferenceSubmittedCount: data.preferenceSubmittedCount ?? null,
    preferenceTotalParticipants: data.preferenceTotalParticipants ?? null,
    myPreferenceSubmitted: data.myPreferenceSubmitted ?? null,
  };
}

function mapPreferenceMyResponse(data: SchedulePreferenceMyResponse): SchedulePreferenceMyResponse {
  return {
    ...data,
    preferenceDeadline: nullableTimestamp(data.preferenceDeadline),
    submittedAt: nullableTimestamp(data.submittedAt),
    updatedAt: nullableTimestamp(data.updatedAt),
    days: data.days ?? [],
    cells: data.cells ?? [],
    comment: data.comment ?? null,
  };
}

function mapPreferenceProgressResponse(data: SchedulePreferenceProgressResponse): SchedulePreferenceProgressResponse {
  return {
    ...data,
    preferenceDeadline: nullableTimestamp(data.preferenceDeadline),
    participants: (data.participants ?? []).map((participant) => ({
      ...participant,
      submittedAt: nullableTimestamp(participant.submittedAt),
      updatedAt: nullableTimestamp(participant.updatedAt),
    })),
  };
}

function mapPreferenceSubmissionsResponse(
  data: SchedulePreferenceSubmissionsResponse,
): SchedulePreferenceSubmissionsResponse {
  return {
    ...data,
    preferenceDeadline: nullableTimestamp(data.preferenceDeadline),
    submissions: (data.submissions ?? []).map((submission) => ({
      ...submission,
      submittedAt: nullableTimestamp(submission.submittedAt),
      updatedAt: nullableTimestamp(submission.updatedAt),
      comment: submission.comment ?? null,
      cells: submission.cells ?? [],
    })),
  };
}

function mapScheduleBuildTemplate(data: ScheduleBuildTemplateDto): ScheduleBuildTemplateDto {
  return {
    ...data,
    description: data.description ?? null,
    createdAt: nullableTimestamp(data.createdAt),
    updatedAt: nullableTimestamp(data.updatedAt),
    positionConfigs: (data.positionConfigs ?? []).map((config) => ({
      ...config,
      shiftOptions: config.shiftOptions ?? [],
      coverageRules: config.coverageRules ?? [],
    })),
  };
}

export async function createSchedule(restaurantId: number, payload: SaveSchedulePayload): Promise<ScheduleData> {
  const { data } = await api.post<ScheduleResponse>(`/api/restaurants/${restaurantId}/schedules`, payload);
  return mapSchedule(data);
}

export async function updateSchedule(
  restaurantId: number,
  scheduleId: number,
  payload: SaveSchedulePayload,
): Promise<ScheduleData> {
  const { data } = await api.put<ScheduleResponse>(`/api/restaurants/${restaurantId}/schedules/${scheduleId}`, payload);
  return mapSchedule(data);
}

export async function deleteSchedule(restaurantId: number, scheduleId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/schedules/${scheduleId}`);
}

export async function listSavedSchedules(restaurantId: number): Promise<ScheduleSummary[]> {
  const { data } = await api.get<ScheduleSummary[]>(`/api/restaurants/${restaurantId}/schedules`);
  return (data ?? []).map(mapScheduleSummary);
}

export async function createDraftSchedule(
  restaurantId: number,
  request: CreateDraftScheduleRequest,
): Promise<ScheduleData> {
  const { data } = await api.post<ScheduleResponse>(`/api/restaurants/${restaurantId}/schedules/drafts`, request);
  return mapSchedule(data);
}

export async function startPreferenceCollection(
  restaurantId: number,
  scheduleId: number,
  request: StartPreferenceCollectionRequest,
): Promise<ScheduleData> {
  const { data } = await api.post<ScheduleResponse>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/preferences/start`,
    request,
  );
  return mapSchedule(data);
}

export async function closePreferenceCollection(restaurantId: number, scheduleId: number): Promise<ScheduleData> {
  const { data } = await api.post<ScheduleResponse>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/preferences/close`,
  );
  return mapSchedule(data);
}

export async function applySchedulePreferencesSimple(restaurantId: number, scheduleId: number): Promise<ScheduleData> {
  const { data } = await api.post<ScheduleResponse>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/preferences/apply-simple`,
  );
  return mapSchedule(data);
}

export async function previewScheduleAutoBuild(
  restaurantId: number,
  scheduleId: number,
  request: PreviewScheduleAutoBuildRequest,
): Promise<ScheduleAutoBuildPreviewResponse> {
  const response = await api.post(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/preferences/auto-build-preview`,
    request,
  );
  const data = response.data ?? {};
  return {
    scheduleId: data.scheduleId,
    templateId: data.templateId,
    effectiveBuildTemplateId: data.effectiveBuildTemplateId ?? data.templateId ?? null,
    templateName: data.templateName,
    positions: (data.positions ?? []).map((position: ScheduleAutoBuildPositionPreviewDto) => ({
      ...position,
      cells: (position.cells ?? []).map((cell) => ({
        ...cell,
        startTime: cell.startTime ?? null,
        endTime: cell.endTime ?? null,
        matchStatus: cell.matchStatus ?? "NO_PREFERENCE",
        warningMessage: cell.warningMessage ?? null,
        warnings: cell.warnings ?? [],
      })),
      warnings: position.warnings ?? [],
      totalAssignments: position.totalAssignments ?? 0,
      warningsCount: position.warningsCount ?? 0,
      unfilledCount: position.unfilledCount ?? 0,
      negativeAssignmentsCount: position.negativeAssignmentsCount ?? 0,
    })),
    warnings: data.warnings ?? [],
    uncoveredSlots: data.uncoveredSlots ?? [],
    rejectionHints: data.rejectionHints ?? [],
    totalAssignments: data.totalAssignments ?? 0,
    warningsCount: data.warningsCount ?? 0,
    unfilledCount: data.unfilledCount ?? 0,
    negativeAssignmentsCount: data.negativeAssignmentsCount ?? 0,
  };
}

export async function applyScheduleAutoBuild(
  restaurantId: number,
  scheduleId: number,
  request: ApplyScheduleAutoBuildRequest,
): Promise<ScheduleData> {
  const { data } = await api.post<ScheduleResponse>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/preferences/auto-build-apply`,
    request,
  );
  return mapSchedule(data);
}

export async function publishSchedule(restaurantId: number, scheduleId: number): Promise<ScheduleData> {
  const { data } = await api.post<ScheduleResponse>(`/api/restaurants/${restaurantId}/schedules/${scheduleId}/publish`);
  return mapSchedule(data);
}

export async function fetchSchedule(restaurantId: number, scheduleId: number): Promise<ScheduleData> {
  const { data } = await api.get<ScheduleResponse>(`/api/restaurants/${restaurantId}/schedules/${scheduleId}`);
  return mapSchedule(data);
}

export async function getScheduleOwnerCandidates(
  restaurantId: number,
  scheduleId: number,
): Promise<ScheduleOwnerDto[]> {
  const { data } = await api.get<ScheduleOwnerDto[]>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/owner-candidates`,
  );
  return data ?? [];
}

export async function changeScheduleOwner(
  restaurantId: number,
  scheduleId: number,
  ownerUserId: number,
): Promise<ScheduleData> {
  const { data } = await api.patch<ScheduleResponse>(`/api/restaurants/${restaurantId}/schedules/${scheduleId}/owner`, {
    ownerUserId,
  });
  return mapSchedule(data);
}

export async function createReplacement(
  restaurantId: number,
  scheduleId: number,
  payload: { day: string; toMemberId: number; reason?: string },
): Promise<ShiftRequestDto> {
  const { data } = await api.post<ShiftRequestDto>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/shift-requests/replacement`,
    payload,
  );
  return data;
}

export async function createSwap(
  restaurantId: number,
  scheduleId: number,
  payload: { myDay: string; targetMemberId: number; targetDay: string; reason?: string },
): Promise<ShiftRequestDto> {
  const { data } = await api.post<ShiftRequestDto>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/shift-requests/swap`,
    payload,
  );
  return data;
}

export async function listShiftRequests(restaurantId: number, scheduleId: number): Promise<ShiftRequestDto[]> {
  const { data } = await api.get<ShiftRequestDto[]>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/shift-requests`,
  );
  return data ?? [];
}

export async function decideAsManager(
  restaurantId: number,
  scheduleId: number,
  requestId: number,
  accepted: boolean,
): Promise<ShiftRequestDto> {
  const { data } = await api.post<ShiftRequestDto>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/shift-requests/${requestId}/manager-decision`,
    { accepted },
  );
  return data;
}

export async function cancelShiftRequest(restaurantId: number, scheduleId: number, requestId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/schedules/${scheduleId}/shift-requests/${requestId}`);
}

export async function getMySchedulePreference(
  restaurantId: number,
  scheduleId: number,
): Promise<SchedulePreferenceMyResponse> {
  const { data } = await api.get<SchedulePreferenceMyResponse>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/preferences/me`,
  );
  return mapPreferenceMyResponse(data);
}

export async function upsertMySchedulePreference(
  restaurantId: number,
  scheduleId: number,
  request: UpsertMySchedulePreferenceRequest,
): Promise<SchedulePreferenceMyResponse> {
  const { data } = await api.put<SchedulePreferenceMyResponse>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/preferences/me`,
    request,
  );
  return mapPreferenceMyResponse(data);
}

export async function getSchedulePreferenceProgress(
  restaurantId: number,
  scheduleId: number,
): Promise<SchedulePreferenceProgressResponse> {
  const { data } = await api.get<SchedulePreferenceProgressResponse>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/preferences/progress`,
  );
  return mapPreferenceProgressResponse(data);
}

export async function getSchedulePreferenceSubmissions(
  restaurantId: number,
  scheduleId: number,
): Promise<SchedulePreferenceSubmissionsResponse> {
  const { data } = await api.get<SchedulePreferenceSubmissionsResponse>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/preferences/submissions`,
  );
  return mapPreferenceSubmissionsResponse(data);
}

export async function listScheduleBuildTemplates(restaurantId: number): Promise<ScheduleBuildTemplateDto[]> {
  const { data } = await api.get<ScheduleBuildTemplateDto[]>(
    `/api/restaurants/${restaurantId}/schedules/build-templates`,
  );
  return (data ?? []).map(mapScheduleBuildTemplate);
}

export async function getScheduleBuildTemplate(
  restaurantId: number,
  templateId: number,
): Promise<ScheduleBuildTemplateDto> {
  const { data } = await api.get<ScheduleBuildTemplateDto>(
    `/api/restaurants/${restaurantId}/schedules/build-templates/${templateId}`,
  );
  return mapScheduleBuildTemplate(data);
}

export async function createScheduleBuildTemplate(
  restaurantId: number,
  request: SaveScheduleBuildTemplateRequest,
): Promise<ScheduleBuildTemplateDto> {
  const { data } = await api.post<ScheduleBuildTemplateDto>(
    `/api/restaurants/${restaurantId}/schedules/build-templates`,
    request,
  );
  return mapScheduleBuildTemplate(data);
}

export async function updateScheduleBuildTemplate(
  restaurantId: number,
  templateId: number,
  request: SaveScheduleBuildTemplateRequest,
): Promise<ScheduleBuildTemplateDto> {
  const { data } = await api.put<ScheduleBuildTemplateDto>(
    `/api/restaurants/${restaurantId}/schedules/build-templates/${templateId}`,
    request,
  );
  return mapScheduleBuildTemplate(data);
}

export async function archiveScheduleBuildTemplate(restaurantId: number, templateId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/schedules/build-templates/${templateId}`);
}

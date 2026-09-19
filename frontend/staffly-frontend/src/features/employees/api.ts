import api from "../../shared/api/apiClient";
import { getMyRoleIn } from "../../shared/api/memberships";
import type { RestaurantRole } from "../../shared/types/restaurant";
import { toAbsoluteUrl } from "../../shared/utils/url";

/* ===== Приглашения (оставляем как было) ===== */
export type InviteRequest = {
  phone: string;
  positionId: number;
};

export type InviteResponse = {
  token: string;
  restaurantId: number;
  desiredRole: RestaurantRole;
  positionId?: number;
  expiresAt: string;
};

export async function sendInvite(restaurantId: number, payload: InviteRequest): Promise<InviteResponse> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/employees/invite`, payload);
  return data as InviteResponse;
}

/* ===== Помощник: узнать мою роль в текущем ресторане ===== */
export async function fetchMyRoleIn(restaurantId: number): Promise<RestaurantRole | null> {
  return getMyRoleIn(restaurantId);
}

/* ===== Список участников ===== */
export type MemberDto = {
  id: number; // id записи membership
  userId: number;
  role: RestaurantRole; // роль доступа в ресторане
  positionId?: number | null;
  positionName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;

  // Имена: используем то, что вернёт бэк. Любое из этих полей — опционально.
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;

  // День рождения пользователя (если бэк его отдаёт)
  birthDate?: string | null; // ISO, напр. "1998-03-12"
};

export async function listMembers(restaurantId: number): Promise<MemberDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/members`);
  const members = data as MemberDto[];
  return members.map((member) => ({
    ...member,
    avatarUrl: toAbsoluteUrl(member.avatarUrl),
  }));
}

export type MemberResponsibilityType = "CERTIFICATION" | "SCHEDULE";

export type MemberResponsibilityCandidateDto = {
  userId: number;
  memberId: number | null;
  displayName: string;
  role: string;
  positionId: number | null;
  positionName: string | null;
};

export type MemberResponsibilityPeriodDto = {
  startDate: string;
  endDate: string;
};

export type MemberResponsibilityItemDto = {
  id: number;
  version?: number | null;
  title: string;
  subtitle: string | null;
  period: MemberResponsibilityPeriodDto | null;
  candidates: MemberResponsibilityCandidateDto[];
};

export type MemberResponsibilityGroupDto = {
  type: MemberResponsibilityType;
  title: string;
  items: MemberResponsibilityItemDto[];
};

export type MemberResponsibilityHandoffOptionsDto = {
  userId: number;
  fullName: string;
  groups: MemberResponsibilityGroupDto[];
};

export type MemberResponsibilityHandoffRequest = {
  items: {
    type: MemberResponsibilityType;
    resourceId: number;
    resourceVersion?: number | null;
    newOwnerUserId: number;
  }[];
};

export async function removeMember(restaurantId: number, memberId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/members/${memberId}`);
}

export async function getMemberResponsibilityHandoffOptions(
  restaurantId: number,
  memberId: number,
): Promise<MemberResponsibilityHandoffOptionsDto> {
  const { data } = await api.get<MemberResponsibilityHandoffOptionsDto>(
    `/api/restaurants/${restaurantId}/members/${memberId}/responsibility-handoff-options`,
  );

  return {
    ...data,
    groups: (data.groups ?? []).map((group) => ({
      ...group,
      items: (group.items ?? []).map((item) => ({
        ...item,
        candidates: item.candidates ?? [],
      })),
    })),
  };
}

export async function submitMemberResponsibilityHandoff(
  restaurantId: number,
  memberId: number,
  payload: MemberResponsibilityHandoffRequest,
): Promise<void> {
  await api.post(`/api/restaurants/${restaurantId}/members/${memberId}/responsibility-handoff`, payload);
}

export async function updateMemberRole(
  restaurantId: number,
  memberId: number,
  role: RestaurantRole,
): Promise<MemberDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/members/${memberId}/role`, {
    role,
  });
  return data as MemberDto;
}

export type PositionChangeAction =
  | "ADD_TO_COLLECTION"
  | "DO_NOT_ADD"
  | "CHANGE_POSITION_AND_REOPEN_COLLECTION"
  | "CHANGE_POSITION_WITHOUT_ADDING_TO_THIS_SCHEDULE"
  | "REOPEN_AND_REBUILD_PREFERENCE_FLOW"
  | "INFORMATION_ONLY";
export type PositionChangeEligibilityProblem = "MISSING_PREFERENCE_MODE" | "MISSING_FROZEN_SHIFT_OPTIONS_FOR_POSITION";
export type PositionChangePosition = { id: number; name: string };
export type PositionChangeEmployee = {
  memberId: number;
  name: string;
  oldPosition: PositionChangePosition;
  newPosition: PositionChangePosition;
  memberCreatedAt: string;
};
export type PublishedShiftImpact = {
  elapsedPreserved: number;
  currentPreserved: number;
  futureToCancel: number;
  legacyUnstructuredPreserved: number;
};
export type OldPositionImpact = {
  scheduleId: number;
  scheduleTitle: string;
  scheduleStatus: string;
  scheduleVersion: number;
  preferenceCollectionCycle: number;
  currentPreferenceDeadline: string | null;
  participationId: number | null;
  participationWillBeRemoved: boolean;
  preferenceSubmissionId: number | null;
  preferenceSubmissionRevision: number | null;
  preferenceDataWillBeDeleted: boolean;
  progressDenominatorWillChange: boolean;
  appliedDraftWillBeInvalidated: boolean;
  activeRowWillBeRemoved: boolean;
  publishedRowBecomesHistorical: boolean;
  publishedShiftImpact: PublishedShiftImpact | null;
};
export type NewPositionOpportunity = {
  scheduleId: number;
  scheduleTitle: string;
  scheduleStatus: string;
  scheduleVersion: number;
  allowedActions: PositionChangeAction[];
  currentPreferenceDeadline: string | null;
  lessThanSixHoursRemain: boolean;
  preferenceMode: string | null;
  newPositionEligible: boolean;
  frozenShiftOptionsRequired: boolean;
  frozenShiftOptionsAvailable: boolean;
  preferenceBuildTemplateId: number | null;
  applicableFrozenShiftOptionSnapshotIds: number[];
  preferenceCollectionCycle: number;
  eligibilityProblems: PositionChangeEligibilityProblem[];
  newDeadlineRequiredForReopen: boolean;
};
export type PositionChangeImpactPlan = {
  calculatedAt: string;
  employee: PositionChangeEmployee;
  oldPositionImpacts: OldPositionImpact[];
  newPositionOpportunities: NewPositionOpportunity[];
};
export type ScheduleDecision = {
  scheduleId: number;
  expectedVersion: number;
  expectedStatus: string;
  expectedCollectionCycle: number;
  expectedPreferenceDeadline: string | null;
  expectedParticipationId: number | null;
  expectedPreferenceSubmissionId: number | null;
  expectedPreferenceSubmissionRevision: number | null;
  action: PositionChangeAction | null;
  newDeadline: string | null;
};
export type ApplyPositionChangeRequest = {
  targetPositionId: number;
  expectedCurrentPositionId: number;
  expectedMemberCreatedAt: string;
  schedules: ScheduleDecision[];
};
export type ApplyPositionChangeResult = {
  member: MemberDto;
  affectedScheduleIds: number[];
  reopenedCollections: { scheduleId: number; deadline: string }[];
  cancelledFutureShiftCount: number;
};

export async function getPositionChangeImpact(
  restaurantId: number,
  memberId: number,
  targetPositionId: number,
): Promise<PositionChangeImpactPlan> {
  const { data } = await api.post<PositionChangeImpactPlan>(
    `/api/restaurants/${restaurantId}/members/${memberId}/position-change-impact`,
    { targetPositionId },
  );
  return data;
}

export async function applyPositionChange(
  restaurantId: number,
  memberId: number,
  request: ApplyPositionChangeRequest,
): Promise<ApplyPositionChangeResult> {
  const { data } = await api.post<ApplyPositionChangeResult>(
    `/api/restaurants/${restaurantId}/members/${memberId}/position-change`,
    request,
  );
  return data;
}

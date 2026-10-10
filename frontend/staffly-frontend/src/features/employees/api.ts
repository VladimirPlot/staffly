import api from "../../shared/api/apiClient";
import { getMyRoleIn } from "../../shared/api/memberships";
import type { RestaurantRole } from "../../shared/types/restaurant";
import { toAbsoluteUrl } from "../../shared/utils/url";

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

export type EmployeeRemovalPosition = { id: number; name: string };
export type EmployeeRemovalScheduleImpact = {
  scheduleId: number;
  scheduleTitle: string;
  scheduleStatus: string;
  scheduleVersion: number;
  preferenceCollectionCycle: number;
  currentPreferenceDeadline: string | null;
  participationId: number | null;
  preferenceSubmissionId: number | null;
  preferenceSubmissionRevision: number | null;
  participationWillBeRemoved: boolean;
  preferenceDataWillBeDeleted: boolean;
  progressDenominatorWillChange: boolean;
  autoBuildWillBecomeStale: boolean;
  activeDraftRowWillBeRemoved: boolean;
  publishedRowBecomesHistorical: boolean;
  publishedShiftImpact: PublishedShiftImpact | null;
};
export type EmployeeRemovalImpactPlan = {
  calculatedAt: string;
  mode: "FORCED" | "SELF_LEAVE";
  employee: {
    memberId: number;
    name: string;
    currentPosition: EmployeeRemovalPosition | null;
    memberCreatedAt: string;
  };
  scheduleImpacts: EmployeeRemovalScheduleImpact[];
  scheduleOwnership: EmployeeRemovalOwnershipImpact;
  certificationOwnership: EmployeeRemovalOwnershipImpact;
  taskImpact: {
    assigneeResponsibilities: EmployeeRemovalTaskResponsibility[];
    setterResponsibilities: EmployeeRemovalTaskResponsibility[];
  };
  checklistImpact: { affectedCount: number };
  reminderImpact: { affectedCount: number };
};
export type EmployeeRemovalOwnershipImpact = { requiredTransfers: EmployeeRemovalOwnershipResource[] };
export type EmployeeRemovalOwnershipResource = {
  resourceId: number;
  title: string;
  version: number;
  expectedOwnerUserId: number;
  candidates: EmployeeRemovalCandidate[];
};
export type EmployeeRemovalCandidate = { memberId: number; userId: number; name: string; position: string | null };
export type EmployeeRemovalTaskResponsibility = {
  taskId: number;
  version: number;
  title: string;
  dueDate: string | null;
  replacementRequired: boolean;
  candidates: EmployeeRemovalCandidate[];
};
export type EmployeeRemovalScheduleToken = {
  scheduleId: number;
  expectedVersion: number;
  expectedStatus: string;
  expectedCollectionCycle: number;
  expectedPreferenceDeadline: string | null;
  expectedParticipationId: number | null;
  expectedPreferenceSubmissionId: number | null;
  expectedPreferenceSubmissionRevision: number | null;
};
export type ApplyEmployeeRemovalRequest = {
  expectedMemberCreatedAt: string;
  expectedCurrentPositionId: number | null;
  schedules: EmployeeRemovalScheduleToken[];
  scheduleOwnershipTransfers: EmployeeRemovalOwnershipTransfer[];
  certificationOwnershipTransfers: EmployeeRemovalOwnershipTransfer[];
  tasks: {
    assignees: EmployeeRemovalTaskTransfer[];
    setters: EmployeeRemovalTaskTransfer[];
  };
};
export type EmployeeRemovalOwnershipTransfer = {
  resourceId: number;
  expectedVersion: number;
  expectedOwnerUserId: number;
  newOwnerUserId: number;
};
export type EmployeeRemovalTaskTransfer = {
  taskId: number;
  expectedVersion: number;
  expectedMemberId: number;
  newMemberId: number | null;
};
export type ApplyEmployeeRemovalResult = {
  removedMemberId: number;
  affectedScheduleIds: number[];
  cancelledFutureShiftCount: number;
  historicalPublishedRowCount: number;
  removedPreferenceSubmissionCount: number;
  removedParticipationCount: number;
  staleAutoBuildScheduleCount: number;
  scheduleOwnersTransferred: number;
  certificationOwnersTransferred: number;
  taskAssigneeTransferCount: number;
  taskOrphanedCount: number;
  taskSetterTransferCount: number;
  checklistReservationsReleased: number;
  remindersDetached: number;
};

export async function getEmployeeRemovalImpact(
  restaurantId: number,
  memberId: number,
): Promise<EmployeeRemovalImpactPlan> {
  const { data } = await api.post<EmployeeRemovalImpactPlan>(
    `/api/restaurants/${restaurantId}/members/${memberId}/removal-impact`,
  );
  return data;
}

export async function applyEmployeeRemoval(
  restaurantId: number,
  memberId: number,
  request: ApplyEmployeeRemovalRequest,
): Promise<ApplyEmployeeRemovalResult> {
  const { data } = await api.post<ApplyEmployeeRemovalResult>(
    `/api/restaurants/${restaurantId}/members/${memberId}/remove`,
    request,
  );
  return data;
}

export type PositionChangeAction =
  | "ADD_TO_COLLECTION"
  | "DO_NOT_ADD"
  | "CHANGE_POSITION_AND_REOPEN_COLLECTION"
  | "CHANGE_POSITION_WITHOUT_ADDING_TO_THIS_SCHEDULE"
  | "REOPEN_AND_REBUILD_PREFERENCE_FLOW"
  | "ADD_TO_DRAFT"
  | "DO_NOT_ADD_TO_DRAFT"
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
  autoBuildWillBecomeStale: boolean;
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
  taskOpportunities?: import("../tasks/api").TaskOpportunity[];
  calculatedAt: string;
  employee: PositionChangeEmployee;
  oldPositionImpacts: OldPositionImpact[];
  newPositionOpportunities: NewPositionOpportunity[];
  currentPositionSnapshot: {
    name: string;
    level: "ADMIN" | "MANAGER" | "STAFF";
    specializations: string[];
    payType: string;
    payRate: number | null;
    normHours: number | null;
  };
  scheduleOwnershipState: { resourceId: number; version: number; ownerUserId: number }[];
  certificationOwnershipState: { resourceId: number; version: number; ownerUserId: number }[];
  targetPositionSnapshot: PositionChangeImpactPlan["currentPositionSnapshot"];
  scheduleOwnership: EmployeeRemovalOwnershipResource[];
  certificationOwnership: EmployeeRemovalOwnershipResource[];
  taskSetters: EmployeeRemovalTaskResponsibility[];
  certificationAudienceChanges: { certificationId: number; title: string; entersAudience: boolean }[];
  reservationsToRelease: number;
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
  taskDecisions?: import("../tasks/api").TaskAudienceDecision[];
  targetPositionId: number;
  expectedCurrentPositionId: number;
  expectedMemberCreatedAt: string;
  schedules: ScheduleDecision[];
  expectedCurrentPosition: PositionChangeImpactPlan["currentPositionSnapshot"];
  expectedScheduleOwnershipState: PositionChangeImpactPlan["scheduleOwnershipState"];
  expectedCertificationOwnershipState: PositionChangeImpactPlan["certificationOwnershipState"];
  expectedTargetPosition: PositionChangeImpactPlan["targetPositionSnapshot"];
  scheduleOwnershipTransfers: EmployeeRemovalOwnershipTransfer[];
  certificationOwnershipTransfers: EmployeeRemovalOwnershipTransfer[];
  taskSetterTransfers: EmployeeRemovalTaskTransfer[];
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

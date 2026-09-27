import api from "../../shared/api/apiClient";
import type { RestaurantRole } from "../../shared/types/restaurant";

export type InviteRole = RestaurantRole;

export type MyInvite = {
  token: string;
  restaurantId: number;
  restaurantName: string;
  desiredRole: InviteRole;
  positionId?: number | null;
  positionName?: string | null;
  expiresAt: string;
};

export async function fetchMyInvites(): Promise<MyInvite[]> {
  const { data } = await api.get("/api/invitations/my");
  return data as MyInvite[];
}

export async function acceptInvite(token: string): Promise<void> {
  await api.post(`/api/invitations/${token}/accept`);
}

export async function declineInvite(token: string): Promise<void> {
  await api.post(`/api/invitations/${token}/decline`);
}

export type InviteEmployeePayload = {
  phone: string;
  positionId: number;
  scheduleIntents: InvitationScheduleDecision[];
};

export type InvitationIntentAction =
  | "ADD_TO_COLLECTION"
  | "DO_NOT_ADD"
  | "ADD_AND_REOPEN_COLLECTION"
  | "ADD_AND_REOPEN_FOR_REBUILD"
  | "INFORMATION_ONLY";

export type InvitationScheduleOpportunity = {
  scheduleId: number;
  scheduleTitle: string;
  scheduleStatus: "DRAFT" | "COLLECTING_PREFERENCES" | "PREFERENCES_CLOSED" | "DRAFT_FROM_PREFERENCES" | "PUBLISHED";
  scheduleVersion: number;
  preferenceCollectionCycle: number;
  currentPreferenceDeadline?: string | null;
  allowedActions: InvitationIntentAction[];
  preferenceMode?: "DAY_LEVEL" | "SHIFT_OPTIONS" | null;
  targetPositionEligible: boolean;
  frozenShiftOptionsRequired: boolean;
  frozenShiftOptionsAvailable: boolean;
  preferenceBuildTemplateId?: number | null;
  applicableFrozenShiftOptionSnapshotIds: number[];
  eligibilityProblems: string[];
  newDeadlineRequired: boolean;
  lessThanSixHoursRemain: boolean;
};

export type InvitationImpactPlan = {
  calculatedAt: string;
  candidate: { phone: string; targetPositionId: number; targetPositionName: string; role: InviteRole };
  scheduleOpportunities: InvitationScheduleOpportunity[];
};

export type InvitationScheduleDecision = {
  scheduleId: number;
  selectedAction: InvitationIntentAction;
  requestedDeadline?: string | null;
  expectedScheduleVersion: number;
  expectedScheduleStatus: InvitationScheduleOpportunity["scheduleStatus"];
  expectedCollectionCycle: number;
  expectedPreferenceDeadline?: string | null;
  expectedPreferenceMode?: InvitationScheduleOpportunity["preferenceMode"];
};

export async function fetchInvitationImpact(
  restaurantId: number,
  payload: { phone: string; positionId: number },
): Promise<InvitationImpactPlan> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/invitations/impact`, payload);
  return data as InvitationImpactPlan;
}

export type InviteResponse = {
  token: string;
  restaurantId: number;
  desiredRole: InviteRole;
  positionId?: number;
  expiresAt: string;
};

export async function inviteEmployee(restaurantId: number, payload: InviteEmployeePayload): Promise<InviteResponse> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/members/invite`, payload);
  return data as InviteResponse;
}

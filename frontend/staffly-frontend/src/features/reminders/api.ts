import api from "../../shared/api/apiClient";

export type ReminderTargetType = "ALL" | "POSITION" | "MEMBER";
export type ReminderPeriodicity = "DAILY" | "WEEKLY" | "MONTHLY" | "ONCE";

export type ReminderMemberDto = {
  id: number;
  userId: number;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  positionId?: number | null;
  positionName?: string | null;
};

export type ReminderPositionDto = {
  id: number;
  name: string;
};

export type ReminderDto = {
  id: number;
  restaurantId: number;
  title: string;
  description?: string | null;
  visibleToAdmin: boolean;
  targetType: ReminderTargetType;
  targetPosition?: ReminderPositionDto | null;
  targetMember?: ReminderMemberDto | null;
  periodicity: ReminderPeriodicity;
  time: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthlyLastDay: boolean;
  onceDate?: string | null;
  nextFireAt?: string | null;
  active: boolean;
  createdBy?: ReminderMemberDto | null;
};

export type ReminderRequest = {
  title: string;
  description?: string;
  visibleToAdmin?: boolean;
  targetType: ReminderTargetType;
  targetPositionId?: number | null;
  targetMemberId?: number | null;
  periodicity: ReminderPeriodicity;
  time: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthlyLastDay?: boolean;
  onceDate?: string | null;
};

export async function listReminders(
  restaurantId: number,
  params?: { positionId?: number }
): Promise<ReminderDto[]> {
  const query: Record<string, any> = {};
  if (params?.positionId) {
    query.positionId = params.positionId;
  }
  const { data } = await api.get(`/api/restaurants/${restaurantId}/reminders`, { params: query });
  return data as ReminderDto[];
}

export async function createReminder(
  restaurantId: number,
  payload: ReminderRequest
): Promise<ReminderDto> {
  const body = {
    title: payload.title.trim(),
    description: payload.description,
    visibleToAdmin: payload.visibleToAdmin,
    targetType: payload.targetType,
    targetPositionId: payload.targetPositionId,
    targetMemberId: payload.targetMemberId,
    periodicity: payload.periodicity,
    time: payload.time,
    dayOfWeek: payload.dayOfWeek,
    dayOfMonth: payload.dayOfMonth,
    monthlyLastDay: payload.monthlyLastDay,
    onceDate: payload.onceDate,
  };
  const { data } = await api.post(`/api/restaurants/${restaurantId}/reminders`, body);
  return data as ReminderDto;
}

export async function updateReminder(
  restaurantId: number,
  reminderId: number,
  payload: ReminderRequest
): Promise<ReminderDto> {
  const body = {
    title: payload.title.trim(),
    description: payload.description,
    visibleToAdmin: payload.visibleToAdmin,
    targetType: payload.targetType,
    targetPositionId: payload.targetPositionId,
    targetMemberId: payload.targetMemberId,
    periodicity: payload.periodicity,
    time: payload.time,
    dayOfWeek: payload.dayOfWeek,
    dayOfMonth: payload.dayOfMonth,
    monthlyLastDay: payload.monthlyLastDay,
    onceDate: payload.onceDate,
  };
  const { data } = await api.put(`/api/restaurants/${restaurantId}/reminders/${reminderId}`, body);
  return data as ReminderDto;
}

export async function deleteReminder(restaurantId: number, reminderId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/reminders/${reminderId}`);
}

import { useMemo, useState } from "react";
import {
  applyEmployeeRemoval,
  getEmployeeRemovalImpact,
  type ApplyEmployeeRemovalRequest,
  type EmployeeRemovalImpactPlan,
  type MemberDto,
} from "../api";

type ApiError = {
  friendlyMessage?: unknown;
  message?: unknown;
  response?: { status?: unknown; data?: { message?: unknown; error?: unknown; meta?: { code?: unknown } } };
};
const apiError = (value: unknown): ApiError => (typeof value === "object" && value ? (value as ApiError) : {});
const errorStatus = (value: unknown) => apiError(value).response?.status;
const errorCode = (value: unknown) => apiError(value).response?.data?.meta?.code;
function errorMessage(value: unknown, fallback: string) {
  const error = apiError(value);
  return (
    [error.friendlyMessage, error.response?.data?.message, error.response?.data?.error, error.message].find(
      (item): item is string => typeof item === "string" && Boolean(item.trim()),
    ) ?? fallback
  );
}

type Params = {
  restaurantId: number | null;
  access: { isAdminLike: boolean; isCreator: boolean; isManagerLike: boolean };
  currentUserId: number | null;
  members: MemberDto[];
  myRole: MemberDto["role"] | null;
  refreshMembers: () => Promise<void>;
  onSelfRemoved: () => void;
};

export function useMemberRemoval({
  restaurantId,
  access,
  currentUserId,
  members,
  myRole,
  refreshMembers,
  onSelfRemoved,
}: Params) {
  const [memberToRemove, setMemberToRemove] = useState<MemberDto | null>(null);
  const [plan, setPlan] = useState<EmployeeRemovalImpactPlan | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [taskSelections, setTaskSelections] = useState<Record<string, number | null>>({});
  const [ownershipSelections, setOwnershipSelections] = useState<Record<string, number | null>>({});
  const adminsCount = useMemo(() => members.filter((member) => member.role === "ADMIN").length, [members]);

  const resetRemoval = () => {
    setMemberToRemove(null);
    setPlan(null);
    setError(null);
    setNotice(null);
  };
  const canRemoveMember = (member: MemberDto) => {
    if (!currentUserId) return false;
    const self = member.userId === currentUserId;
    if (!access.isManagerLike || myRole === "STAFF") return self;
    if (access.isAdminLike) return !(!access.isCreator && self && member.role === "ADMIN" && adminsCount <= 1);
    return self || member.role === "STAFF";
  };

  const fetchImpact = async (member: MemberDto, stale = false) => {
    if (!restaurantId) return;
    setLoadingImpact(true);
    setError(null);
    setPlan(null);
    try {
      const impact = await getEmployeeRemovalImpact(restaurantId, member.id);
      setPlan(impact);
      const selections: Record<string, number | null> = {};
      if (impact.mode === "FORCED") impact.taskImpact.assigneeResponsibilities.forEach((task) => {
        selections[`assignee:${task.taskId}`] = task.candidates[0]?.memberId ?? null;
      });
      impact.taskImpact.setterResponsibilities.forEach((task) => {
        selections[`setter:${task.taskId}`] = task.candidates[0]?.memberId ?? null;
      });
      setTaskSelections(selections);
      const owners: Record<string, number | null> = {};
      impact.scheduleOwnership.requiredTransfers.forEach((item) => owners[`schedule:${item.resourceId}`] = item.candidates[0]?.userId ?? null);
      impact.certificationOwnership.requiredTransfers.forEach((item) => owners[`certification:${item.resourceId}`] = item.candidates[0]?.userId ?? null);
      setOwnershipSelections(owners);
      setNotice(
        stale
          ? "Данные сотрудника или связанных графиков изменились. Мы обновили последствия удаления. Проверьте их ещё раз."
          : null,
      );
    } catch (value) {
      if (errorStatus(value) === 404) {
        resetRemoval();
        await refreshMembers();
        setSuccess("Сотрудник уже отсутствует в ресторане.");
      } else setError(errorMessage(value, "Не удалось проверить последствия удаления. Сотрудник не удалён."));
    } finally {
      setLoadingImpact(false);
    }
  };
  const open = (member: MemberDto) => {
    resetRemoval();
    setMemberToRemove(member);
    void fetchImpact(member);
  };
  const close = () => {
    if (!removing && !loadingImpact) resetRemoval();
  };
  const requestFrom = (source: EmployeeRemovalImpactPlan): ApplyEmployeeRemovalRequest => ({
    expectedMemberCreatedAt: source.employee.memberCreatedAt,
    expectedCurrentPositionId: source.employee.currentPosition?.id ?? null,
    schedules: source.scheduleImpacts.map((schedule) => ({
      scheduleId: schedule.scheduleId,
      expectedVersion: schedule.scheduleVersion,
      expectedStatus: schedule.scheduleStatus,
      expectedCollectionCycle: schedule.preferenceCollectionCycle,
      expectedPreferenceDeadline: schedule.currentPreferenceDeadline,
      expectedParticipationId: schedule.participationId,
      expectedPreferenceSubmissionId: schedule.preferenceSubmissionId,
      expectedPreferenceSubmissionRevision: schedule.preferenceSubmissionRevision,
    })),
    scheduleOwnershipTransfers: source.scheduleOwnership.requiredTransfers.map((item) => ({
      resourceId: item.resourceId, expectedVersion: item.version, expectedOwnerUserId: item.expectedOwnerUserId,
      newOwnerUserId: ownershipSelections[`schedule:${item.resourceId}`]!,
    })),
    certificationOwnershipTransfers: source.certificationOwnership.requiredTransfers.map((item) => ({
      resourceId: item.resourceId, expectedVersion: item.version, expectedOwnerUserId: item.expectedOwnerUserId,
      newOwnerUserId: ownershipSelections[`certification:${item.resourceId}`]!,
    })),
    tasks: {
      assignees: source.taskImpact.assigneeResponsibilities.map((task) => ({
        taskId: task.taskId, expectedVersion: task.version, expectedMemberId: source.employee.memberId,
        newMemberId: source.mode === "FORCED" ? taskSelections[`assignee:${task.taskId}`]! : null,
      })),
      setters: source.taskImpact.setterResponsibilities.map((task) => ({
        taskId: task.taskId, expectedVersion: task.version, expectedMemberId: source.employee.memberId,
        newMemberId: taskSelections[`setter:${task.taskId}`]!,
      })),
    },
  });
  const confirmRemove = async () => {
    if (!restaurantId || !memberToRemove || !plan || removing) return;
    const member = memberToRemove;
    setRemoving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await applyEmployeeRemoval(restaurantId, member.id, requestFrom(plan));
      await refreshMembers();
      if (member.userId === currentUserId) onSelfRemoved();
      resetRemoval();
      const detail = [
        result.cancelledFutureShiftCount ? `Отменено будущих смен: ${result.cancelledFutureShiftCount}.` : null,
        result.staleAutoBuildScheduleCount
          ? `Результат автосборки устарел в графиках: ${result.staleAutoBuildScheduleCount}. Проверьте их вручную или запустите автосборку повторно.`
          : null,
        result.taskAssigneeTransferCount ? `Передано задач: ${result.taskAssigneeTransferCount}.` : null,
        result.taskOrphanedCount ? `Задач без исполнителя: ${result.taskOrphanedCount}.` : null,
        result.taskSetterTransferCount ? `Передано постановщиков: ${result.taskSetterTransferCount}.` : null,
        result.checklistReservationsReleased ? `Освобождено бронирований: ${result.checklistReservationsReleased}.` : null,
        result.remindersDetached ? `Остановлено напоминаний: ${result.remindersDetached}.` : null,
      ]
        .filter(Boolean)
        .join(" ");
      setSuccess(`${plan.mode === "SELF_LEAVE" ? "Вы покинули ресторан" : "Сотрудник исключён"}.${detail ? ` ${detail}` : ""}`);
    } catch (value) {
      if (errorCode(value) === "EMPLOYEE_REMOVAL_PLAN_STALE") await fetchImpact(member, true);
      else if (errorStatus(value) === 404) {
        resetRemoval();
        await refreshMembers();
        setSuccess("Сотрудник уже отсутствует в ресторане.");
      } else setError(errorMessage(value, "Не удалось завершить membership. Проверьте решения и попробуйте ещё раз."));
    } finally {
      setRemoving(false);
    }
  };

  return {
    memberToRemove,
    plan,
    loadingImpact,
    removing,
    error,
    notice,
    success,
    setSuccess,
    canRemoveMember,
    open,
    close,
    confirmRemove,
    taskSelections,
    selectTaskReplacement: (key: string, memberId: number) =>
      setTaskSelections((current) => ({ ...current, [key]: memberId })),
    ownershipSelections,
    selectOwnershipReplacement: (key: string, userId: number) =>
      setOwnershipSelections((current) => ({ ...current, [key]: userId })),
  };
}

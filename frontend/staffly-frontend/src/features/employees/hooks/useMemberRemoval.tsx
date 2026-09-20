import { useMemo, useState } from "react";
import {
  applyEmployeeRemoval,
  getEmployeeRemovalImpact,
  getMemberResponsibilityHandoffOptions,
  submitMemberResponsibilityHandoff,
  type ApplyEmployeeRemovalRequest,
  type EmployeeRemovalImpactPlan,
  type MemberDto,
  type MemberResponsibilityHandoffOptionsDto,
  type MemberResponsibilityHandoffRequest,
} from "../api";
import { getMemberResponsibilityItemKey } from "../components/MemberResponsibilityHandoffDialog";

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
  const [pendingHandoffMember, setPendingHandoffMember] = useState<MemberDto | null>(null);
  const [handoffOptions, setHandoffOptions] = useState<MemberResponsibilityHandoffOptionsDto | null>(null);
  const [handoffSelections, setHandoffSelections] = useState<Record<string, number | null>>({});
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffSaving, setHandoffSaving] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const adminsCount = useMemo(() => members.filter((member) => member.role === "ADMIN").length, [members]);

  const resetHandoff = () => {
    setPendingHandoffMember(null);
    setHandoffOptions(null);
    setHandoffSelections({});
    setHandoffError(null);
  };
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
      setPlan(await getEmployeeRemovalImpact(restaurantId, member.id));
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
  const closeHandoff = () => {
    if (!handoffLoading && !handoffSaving) resetHandoff();
  };

  const openHandoff = async (member: MemberDto, originalError: unknown) => {
    if (!restaurantId) return;
    resetHandoff();
    setHandoffLoading(true);
    try {
      const options = await getMemberResponsibilityHandoffOptions(restaurantId, member.id);
      if (!options.groups.some((group) => group.items.length)) {
        setError(errorMessage(originalError, "Сотрудника нельзя удалить, пока он отвечает за активные объекты."));
        return;
      }
      resetRemoval();
      setPendingHandoffMember(member);
      setHandoffOptions(options);
      setHandoffSelections(
        options.groups.reduce<Record<string, number | null>>((result, group) => {
          group.items.forEach((item) => {
            result[getMemberResponsibilityItemKey(group.type, item.id)] =
              member.userId === currentUserId ? null : (item.candidates[0]?.userId ?? null);
          });
          return result;
        }, {}),
      );
    } catch (value) {
      setError(errorMessage(value, errorMessage(originalError, "Не удалось открыть переназначение ответственностей.")));
    } finally {
      setHandoffLoading(false);
    }
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
        result.invalidatedAppliedPreferenceDraftCount
          ? `Графики, требующие повторной сборки: ${result.invalidatedAppliedPreferenceDraftCount}.`
          : null,
      ]
        .filter(Boolean)
        .join(" ");
      setSuccess(`Сотрудник удалён.${detail ? ` ${detail}` : ""}`);
    } catch (value) {
      if (errorCode(value) === "EMPLOYEE_REMOVAL_PLAN_STALE") await fetchImpact(member, true);
      else if (errorStatus(value) === 404) {
        resetRemoval();
        await refreshMembers();
        setSuccess("Сотрудник уже отсутствует в ресторане.");
      } else if (errorStatus(value) === 409) await openHandoff(member, value);
      else setError(errorMessage(value, "Не удалось удалить сотрудника. Попробуйте ещё раз."));
    } finally {
      setRemoving(false);
    }
  };

  const selectHandoffOwner = (key: string, owner: number | null) =>
    setHandoffSelections((old) => ({ ...old, [key]: owner }));
  const confirmHandoff = async () => {
    if (!restaurantId || !pendingHandoffMember || !handoffOptions) return;
    const payload: MemberResponsibilityHandoffRequest = { items: [] };
    for (const group of handoffOptions.groups)
      for (const item of group.items) {
        const owner = handoffSelections[getMemberResponsibilityItemKey(group.type, item.id)];
        if (owner == null) {
          setHandoffError("Выберите нового ответственного для каждого объекта");
          return;
        }
        payload.items.push({
          type: group.type,
          resourceId: item.id,
          resourceVersion: item.version ?? null,
          newOwnerUserId: owner,
        });
      }
    setHandoffSaving(true);
    setHandoffError(null);
    try {
      const member = pendingHandoffMember;
      await submitMemberResponsibilityHandoff(restaurantId, member.id, payload);
      resetHandoff();
      setMemberToRemove(member);
      await fetchImpact(member);
    } catch (value) {
      setHandoffError(errorMessage(value, "Не удалось переназначить ответственных"));
    } finally {
      setHandoffSaving(false);
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
    pendingHandoffMember,
    handoffOptions,
    handoffSelections,
    handoffLoading,
    handoffSaving,
    handoffError,
    closeHandoff,
    selectHandoffOwner,
    confirmHandoff,
  };
}

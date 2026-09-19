import { useMemo, useState } from "react";
import type { PositionDto } from "../../dictionaries/api";
import {
  applyPositionChange,
  getPositionChangeImpact,
  type ApplyPositionChangeRequest,
  type MemberDto,
  type PositionChangeAction,
  type PositionChangeImpactPlan,
} from "../api";
import { getFriendlyEmployeeErrorMessage } from "../utils/errorMessages";
import { restaurantLocalDateTimeToInstant } from "../../schedule/utils/date";

export type PositionDecision = { action: PositionChangeAction; newDeadline: string };

export function buildPositionChangeRequest(
  plan: PositionChangeImpactPlan,
  decisions: Record<number, PositionDecision>,
  restaurantTimeZone: string,
): ApplyPositionChangeRequest {
  const oldById = new Map(plan.oldPositionImpacts.map((impact) => [impact.scheduleId, impact]));
  const newById = new Map(plan.newPositionOpportunities.map((opportunity) => [opportunity.scheduleId, opportunity]));
  const scheduleIds = new Set([...oldById.keys(), ...newById.keys()]);
  return {
    targetPositionId: plan.employee.newPosition.id,
    expectedCurrentPositionId: plan.employee.oldPosition.id,
    expectedMemberCreatedAt: plan.employee.memberCreatedAt,
    schedules: [...scheduleIds]
      .sort((a, b) => a - b)
      .map((scheduleId) => {
        const old = oldById.get(scheduleId);
        const opportunity = newById.get(scheduleId);
        const source = opportunity ?? old!;
        const decision = opportunity ? decisions[scheduleId] : undefined;
        const informationOnly = Boolean(
          opportunity &&
            (opportunity.scheduleStatus === "DRAFT" ||
              opportunity.scheduleStatus === "PUBLISHED" ||
              (opportunity.allowedActions.length === 1 && opportunity.allowedActions[0] === "INFORMATION_ONLY")),
        );
        return {
          scheduleId,
          expectedVersion: source.scheduleVersion,
          expectedStatus: source.scheduleStatus,
          expectedCollectionCycle: source.preferenceCollectionCycle,
          expectedPreferenceDeadline: source.currentPreferenceDeadline,
          expectedParticipationId: old?.participationId ?? null,
          expectedPreferenceSubmissionId: old?.preferenceSubmissionId ?? null,
          expectedPreferenceSubmissionRevision: old?.preferenceSubmissionRevision ?? null,
          action: informationOnly ? "INFORMATION_ONLY" : (decision?.action ?? null),
          newDeadline: decision?.newDeadline
            ? restaurantLocalDateTimeToInstant(decision.newDeadline, restaurantTimeZone)
            : null,
        };
      }),
  };
}

function stale(error: unknown) {
  const body = (error as { response?: { data?: { code?: string; errorCode?: string; message?: string } } }).response
    ?.data;
  return (
    body?.code === "POSITION_CHANGE_PLAN_STALE" ||
    body?.errorCode === "POSITION_CHANGE_PLAN_STALE" ||
    body?.message?.includes("POSITION_CHANGE_PLAN_STALE")
  );
}

export function useMemberEditPosition({
  restaurantId,
  allPositions,
  onApplied,
  restaurantTimeZone,
}: {
  restaurantId: number | null;
  allPositions: PositionDto[];
  onApplied: (member: MemberDto) => Promise<void>;
  restaurantTimeZone: string;
}) {
  const [memberToEdit, setMemberToEdit] = useState<MemberDto | null>(null);
  const [editPositionId, setEditPositionId] = useState<number | null>(null);
  const [plan, setPlan] = useState<PositionChangeImpactPlan | null>(null);
  const [decisions, setDecisions] = useState<Record<number, PositionDecision>>({});
  const [saving, setSaving] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const editOptions = useMemo(
    () => allPositions.filter((p) => p.active && p.level === memberToEdit?.role && p.id !== memberToEdit.positionId),
    [allPositions, memberToEdit],
  );
  const open = (member: MemberDto) => {
    setMemberToEdit(member);
    setEditPositionId(null);
    setPlan(null);
    setDecisions({});
    setError(null);
  };
  const close = () => {
    if (!saving && !loadingImpact) {
      setMemberToEdit(null);
      setPlan(null);
      setDecisions({});
      setError(null);
    }
  };
  const preview = async () => {
    if (!restaurantId || !memberToEdit || !editPositionId) return setError("Выберите должность");
    setLoadingImpact(true);
    setError(null);
    try {
      setPlan(await getPositionChangeImpact(restaurantId, memberToEdit.id, editPositionId));
      setDecisions({});
    } catch (e) {
      setError(getFriendlyEmployeeErrorMessage(e, "Не удалось проверить последствия"));
    } finally {
      setLoadingImpact(false);
    }
  };
  const apply = async () => {
    if (!restaurantId || !memberToEdit || !plan) return;
    setSaving(true);
    setError(null);
    try {
      const result = await applyPositionChange(
        restaurantId,
        memberToEdit.id,
        buildPositionChangeRequest(plan, decisions, restaurantTimeZone),
      );
      await onApplied(result.member);
      setMemberToEdit(null);
      setPlan(null);
      setDecisions({});
      setSuccess(
        `Должность сотрудника изменена${result.cancelledFutureShiftCount ? `. Отменено будущих смен: ${result.cancelledFutureShiftCount}` : ""}`,
      );
    } catch (e) {
      if (stale(e)) {
        try {
          setPlan(await getPositionChangeImpact(restaurantId, memberToEdit.id, plan.employee.newPosition.id));
          setDecisions({});
          setError(
            "Данные графиков изменились, пока вы подтверждали смену должности. Мы обновили информацию — проверьте изменения ещё раз.",
          );
        } catch (refreshError) {
          setError(getFriendlyEmployeeErrorMessage(refreshError, "Не удалось обновить информацию"));
        }
      } else setError(getFriendlyEmployeeErrorMessage(e, "Не удалось сменить должность"));
    } finally {
      setSaving(false);
    }
  };
  return {
    memberToEdit,
    editPositionId,
    setEditPositionId,
    plan,
    decisions,
    setDecisions,
    saving,
    loadingImpact,
    error,
    success,
    setSuccess,
    editOptions,
    open,
    close,
    preview,
    apply,
  };
}

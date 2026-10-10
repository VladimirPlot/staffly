import { useEffect, useMemo, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import {
  fetchInvitationImpact,
  inviteEmployee,
  type InvitationImpactPlan,
  type InvitationIntentAction,
  type InvitationScheduleDecision,
} from "../../invitations/api";
import type { PositionDto } from "../../dictionaries/api";
import { DEFAULT_PHONE_COUNTRY, normalizePhoneForSubmit } from "../../../shared/utils/phone";
import { getFriendlyEmployeeErrorMessage } from "../utils/errorMessages";
import { actionAcceptsDeadline, deadlineValidation } from "../utils/invitationDeadline";
import type { TaskAudienceAction } from "../../tasks/api";

type AccessFlags = {
  isManagerLike: boolean;
};

export function useInviteForm(
  restaurantId: number | null,
  access: AccessFlags,
  positions: PositionDto[],
  restaurantTimeZone: string,
) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDone, setInviteDone] = useState(false);
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [phoneCountry, setPhoneCountry] = useState<CountryCode | undefined>(DEFAULT_PHONE_COUNTRY);
  const [phoneCountryLocked, setPhoneCountryLocked] = useState(false);
  const [positionId, setPositionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<InvitationImpactPlan | null>(null);
  const [decisions, setDecisions] = useState<Record<number, InvitationIntentAction>>({});
  const [taskChoices, setTaskChoices] = useState<Record<number, TaskAudienceAction>>({});
  const [deadlines, setDeadlines] = useState<Record<number, string>>({});
  const [validationNow, setValidationNow] = useState(Date.now);

  useEffect(() => {
    if (!inviteOpen || !impact) return;
    const timer = window.setInterval(() => setValidationNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [inviteOpen, impact]);

  const canInvite = access.isManagerLike;
  const normalizedPhone = normalizePhoneForSubmit(phone, {
    selectedCountry: phoneCountry,
    isCountryLocked: phoneCountryLocked,
  });
  const phoneError =
    phone && (!normalizedPhone.e164 || !normalizedPhone.isValid) ? "Введите корректный номер телефона" : undefined;

  useEffect(() => {
    if (positions.length === 0) {
      setPositionId(null);
      return;
    }
    if (!positionId || !positions.some((position) => position.id === positionId)) {
      setPositionId(positions[0].id);
    }
  }, [positions, positionId]);

  const resetForm = () => {
    setPhone(undefined);
    setInviteDone(false);
    setError(null);
    setImpact(null);
    setDecisions({});
    setTaskChoices({});
    setDeadlines({});
  };

  const submit = async () => {
    if (!restaurantId || !phone) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!positionId) {
        setError("Выберите должность");
        return;
      }
      if (!normalizedPhone.e164 || !normalizedPhone.isValid) {
        return;
      }
      const plan = await fetchInvitationImpact(restaurantId, {
        phone: normalizedPhone.e164,
        positionId,
      });
      setValidationNow(Date.now());
      setImpact(plan);
      setTaskChoices({});
      setDecisions({});
      setTaskChoices({});
      setDeadlines({});
    } catch (error: unknown) {
      setError(getFriendlyEmployeeErrorMessage(error, "Не удалось отправить приглашение"));
    } finally {
      setSubmitting(false);
    }
  };

  const deadlineValidations = useMemo(
    () =>
      Object.fromEntries(
        (impact?.scheduleOpportunities ?? []).map((item) => [
          item.scheduleId,
          deadlineValidation(
            item,
            decisions[item.scheduleId],
            deadlines[item.scheduleId] ?? "",
            restaurantTimeZone,
            validationNow,
          ),
        ]),
      ),
    [decisions, deadlines, impact, restaurantTimeZone, validationNow],
  );

  const allRequiredScheduleDecisionsSelected = useMemo(() => {
    if (!impact) return false;
    return (
      (impact.taskOpportunities ?? [])
        .filter((t) => t.completionMode === "EACH" && !t.leaving)
        .every((t) => !!taskChoices[t.taskId]) &&
      impact.scheduleOpportunities.every((item) => {
        if (isInformationOnly(item.allowedActions)) return true;
        const action = decisions[item.scheduleId];
        if (!action || !item.allowedActions.includes(action)) return false;
        if (action !== "DO_NOT_ADD" && action !== "DO_NOT_ADD_TO_DRAFT" && item.eligibilityProblems.length > 0)
          return false;
        return deadlineValidations[item.scheduleId].valid;
      })
    );
  }, [decisions, deadlineValidations, impact, taskChoices]);

  const confirm = async () => {
    if (!restaurantId || !impact || !normalizedPhone.e164 || !positionId || !allRequiredScheduleDecisionsSelected)
      return;
    setSubmitting(true);
    setError(null);
    try {
      const now = Date.now();
      const scheduleIntents: InvitationScheduleDecision[] = impact.scheduleOpportunities.map((item) => {
        const selectedAction = isInformationOnly(item.allowedActions) ? "INFORMATION_ONLY" : decisions[item.scheduleId];
        if (!selectedAction) throw new Error("Выберите действие для каждого графика");
        const validation = deadlineValidation(
          item,
          selectedAction,
          deadlines[item.scheduleId] ?? "",
          restaurantTimeZone,
          now,
        );
        if (!validation.valid) throw new Error(validation.error ?? "Проверьте дедлайн");
        return {
          scheduleId: item.scheduleId,
          selectedAction,
          requestedDeadline: validation.requestedDeadline,
          expectedScheduleVersion: item.scheduleVersion,
          expectedScheduleStatus: item.scheduleStatus,
          expectedCollectionCycle: item.preferenceCollectionCycle,
          expectedPreferenceDeadline: item.currentPreferenceDeadline,
          expectedPreferenceMode: item.preferenceMode,
        };
      });
      const taskDecisions = (impact.taskOpportunities ?? [])
        .filter((t) => t.completionMode === "EACH" && !t.leaving)
        .map((t) => ({ taskId: t.taskId, expectedVersion: t.version, action: taskChoices[t.taskId] }));
      await inviteEmployee(restaurantId, { phone: normalizedPhone.e164, positionId, scheduleIntents, taskDecisions });
      setInviteDone(true);
      setImpact(null);
    } catch (error: unknown) {
      setError(
        error && typeof error === "object" && "response" in error
          ? getFriendlyEmployeeErrorMessage(error, "Не удалось отправить приглашение")
          : error instanceof Error
            ? error.message
            : "Не удалось отправить приглашение",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = useMemo(
    () => !phone || !positionId || !normalizedPhone.e164 || !normalizedPhone.isValid || submitting,
    [normalizedPhone.e164, normalizedPhone.isValid, phone, positionId, submitting],
  );

  return {
    canInvite,
    positions,
    inviteOpen,
    setInviteOpen,
    inviteDone,
    phone,
    setPhone,
    phoneCountry,
    phoneCountryLocked,
    phoneError,
    setPhoneCountry,
    setPhoneCountryLocked,
    positionId,
    setPositionId,
    submitting,
    error,
    impact,
    decisions,
    taskChoices,
    setTaskChoice: (id: number, action: TaskAudienceAction) =>
      setTaskChoices((current) => ({ ...current, [id]: action })),
    deadlines,
    deadlineValidations,
    allRequiredScheduleDecisionsSelected,
    setDecision: (scheduleId: number, action: InvitationIntentAction) => {
      setDecisions((current) => ({ ...current, [scheduleId]: action }));
      if (!actionAcceptsDeadline(action)) {
        setDeadlines((current) => {
          const next = { ...current };
          delete next[scheduleId];
          return next;
        });
      }
    },
    setDeadline: (scheduleId: number, value: string) =>
      setDeadlines((current) => ({ ...current, [scheduleId]: value })),
    backToDetails: () => {
      setImpact(null);
      setDecisions({});
      setTaskChoices({});
      setDeadlines({});
      setError(null);
    },
    submit,
    confirm,
    resetForm,
    isSubmitDisabled,
  };
}

function isInformationOnly(actions: InvitationIntentAction[]): boolean {
  return actions.length === 1 && actions[0] === "INFORMATION_ONLY";
}

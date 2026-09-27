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
import { restaurantLocalDateTimeToInstant } from "../../schedule/utils/date";

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
  const [deadlines, setDeadlines] = useState<Record<number, string>>({});

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
      setImpact(plan);
      setDecisions({});
      setDeadlines({});
    } catch (error: unknown) {
      setError(getFriendlyEmployeeErrorMessage(error, "Не удалось отправить приглашение"));
    } finally {
      setSubmitting(false);
    }
  };

  const allRequiredScheduleDecisionsSelected = useMemo(() => {
    if (!impact) return false;
    return impact.scheduleOpportunities.every((item) => {
      if (isInformationOnly(item.allowedActions)) return true;
      const action = decisions[item.scheduleId];
      if (!action || !item.allowedActions.includes(action)) return false;
      if (action !== "DO_NOT_ADD" && item.eligibilityProblems.length > 0) return false;

      const localDeadline = deadlines[item.scheduleId];
      if (!actionAcceptsDeadline(action)) return true;
      if (!localDeadline) return !item.newDeadlineRequired;
      const instant = restaurantLocalDateTimeToInstant(localDeadline, restaurantTimeZone);
      if (!instant || new Date(instant).getTime() <= Date.now()) return false;
      return !item.currentPreferenceDeadline || new Date(instant) >= new Date(item.currentPreferenceDeadline);
    });
  }, [decisions, deadlines, impact, restaurantTimeZone]);

  const confirm = async () => {
    if (!restaurantId || !impact || !normalizedPhone.e164 || !positionId || !allRequiredScheduleDecisionsSelected)
      return;
    setSubmitting(true);
    setError(null);
    try {
      const scheduleIntents: InvitationScheduleDecision[] = impact.scheduleOpportunities.map((item) => {
        const selectedAction = isInformationOnly(item.allowedActions) ? "INFORMATION_ONLY" : decisions[item.scheduleId];
        const localDeadline = deadlines[item.scheduleId];
        const requestedDeadline =
          actionAcceptsDeadline(selectedAction) && localDeadline
            ? restaurantLocalDateTimeToInstant(localDeadline, restaurantTimeZone)
            : null;
        if (!selectedAction) throw new Error("Выберите действие для каждого графика");
        if (item.newDeadlineRequired && selectedAction !== "DO_NOT_ADD" && !requestedDeadline) {
          throw new Error("Укажите новый дедлайн для переоткрытия сбора");
        }
        if (localDeadline && !requestedDeadline) throw new Error("Проверьте локальное время дедлайна");
        return {
          scheduleId: item.scheduleId,
          selectedAction,
          requestedDeadline,
          expectedScheduleVersion: item.scheduleVersion,
          expectedScheduleStatus: item.scheduleStatus,
          expectedCollectionCycle: item.preferenceCollectionCycle,
          expectedPreferenceDeadline: item.currentPreferenceDeadline,
          expectedPreferenceMode: item.preferenceMode,
        };
      });
      await inviteEmployee(restaurantId, { phone: normalizedPhone.e164, positionId, scheduleIntents });
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
    deadlines,
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

function actionAcceptsDeadline(action: InvitationIntentAction | undefined): boolean {
  return (
    action === "ADD_TO_COLLECTION" || action === "ADD_AND_REOPEN_COLLECTION" || action === "ADD_AND_REOPEN_FOR_REBUILD"
  );
}

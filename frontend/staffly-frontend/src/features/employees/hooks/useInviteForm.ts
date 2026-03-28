import { useEffect, useMemo, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { inviteEmployee } from "../../invitations/api";
import type { PositionDto } from "../../dictionaries/api";
import { DEFAULT_PHONE_COUNTRY, normalizePhoneForSubmit } from "../../../shared/utils/phone";

type AccessFlags = {
  isManagerLike: boolean;
};

export function useInviteForm(
  restaurantId: number | null,
  access: AccessFlags,
  positions: PositionDto[]
) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDone, setInviteDone] = useState(false);
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [phoneCountry, setPhoneCountry] = useState<CountryCode | undefined>(DEFAULT_PHONE_COUNTRY);
  const [phoneCountryLocked, setPhoneCountryLocked] = useState(false);
  const [positionId, setPositionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInvite = access.isManagerLike;
  const normalizedPhone = normalizePhoneForSubmit(phone, {
    selectedCountry: phoneCountry,
    isCountryLocked: phoneCountryLocked,
  });
  const phoneError =
    phone && (!normalizedPhone.e164 || !normalizedPhone.isValid)
      ? "Введите корректный номер телефона"
      : undefined;

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
      await inviteEmployee(restaurantId, {
        phone: normalizedPhone.e164,
        positionId,
      });
      setInviteDone(true);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Не удалсь отправить приглашение");
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = useMemo(
    () => !phone || !positionId || !normalizedPhone.e164 || !normalizedPhone.isValid || submitting,
    [normalizedPhone.e164, normalizedPhone.isValid, phone, positionId, submitting]
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
    submit,
    resetForm,
    isSubmitDisabled,
  };
}

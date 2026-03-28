import { useEffect, useMemo, useState } from "react";
import { inviteEmployee } from "../../invitations/api";
import type { PositionDto } from "../../dictionaries/api";

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
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [positionId, setPositionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInvite = access.isManagerLike;

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
    setPhoneOrEmail("");
    setInviteDone(false);
    setError(null);
  };

  const submit = async () => {
    if (!restaurantId || !phoneOrEmail.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!positionId) {
        setError("Выберите должность");
        return;
      }
      await inviteEmployee(restaurantId, {
        phoneOrEmail: phoneOrEmail.trim(),
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
    () => !phoneOrEmail.trim() || !positionId || submitting,
    [phoneOrEmail, positionId, submitting]
  );

  return {
    canInvite,
    positions,
    inviteOpen,
    setInviteOpen,
    inviteDone,
    phoneOrEmail,
    setPhoneOrEmail,
    positionId,
    setPositionId,
    submitting,
    error,
    submit,
    resetForm,
    isSubmitDisabled,
  };
}

import { useEffect, useMemo, useState } from "react";
import { inviteEmployee, type InviteRole } from "../../invitations/api";
import type { PositionDto } from "../../dictionaries/api";

type AccessFlags = {
  isManagerLike: boolean;
};

export function useInviteForm(
  restaurantId: number | null,
  access: AccessFlags,
  roleOptions: InviteRole[],
  getPositionsByRole: (role: InviteRole) => PositionDto[]
) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDone, setInviteDone] = useState(false);
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [role, setRole] = useState<InviteRole>(roleOptions[0] ?? "STAFF");
  const [positionId, setPositionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const positions = useMemo(() => getPositionsByRole(role), [getPositionsByRole, role]);
  const canInvite = access.isManagerLike;

  useEffect(() => {
    if (!roleOptions.includes(role)) {
      setRole(roleOptions[0] ?? "STAFF");
    }
  }, [role, roleOptions]);

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
      await inviteEmployee(restaurantId, {
        phoneOrEmail: phoneOrEmail.trim(),
        role,
        positionId: positionId ?? undefined,
      });
      setInviteDone(true);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Не удалсь отправить приглашение");
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = useMemo(
    () => !phoneOrEmail.trim() || submitting,
    [phoneOrEmail, submitting]
  );

  return {
    canInvite,
    positions,
    inviteOpen,
    setInviteOpen,
    inviteDone,
    phoneOrEmail,
    setPhoneOrEmail,
    role,
    setRole,
    positionId,
    setPositionId,
    submitting,
    error,
    submit,
    resetForm,
    isSubmitDisabled,
  };
}

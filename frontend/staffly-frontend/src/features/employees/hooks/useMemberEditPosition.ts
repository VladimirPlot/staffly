import { useMemo, useState } from "react";
import type { PositionDto } from "../../dictionaries/api";
import type { MemberDto } from "../api";
import { displayNameOf } from "../utils/memberUtils";

type UseMemberEditPositionParams = {
  restaurantId: number | null;
  allPositions: PositionDto[];
  updateRole: (memberId: number, role: PositionDto["level"]) => Promise<MemberDto>;
  updatePosition: (memberId: number, positionId: number | null) => Promise<MemberDto>;
};

export function useMemberEditPosition({
  restaurantId,
  allPositions,
  updateRole,
  updatePosition,
}: UseMemberEditPositionParams) {
  const [memberToEdit, setMemberToEdit] = useState<MemberDto | null>(null);
  const [editPositionId, setEditPositionId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (member: MemberDto) => {
    setMemberToEdit(member);
    setEditPositionId(member.positionId ?? null);
    setError(null);
  };

  const close = () => {
    if (saving) return;
    setMemberToEdit(null);
    setError(null);
  };

  const editOptions = useMemo(() => allPositions.filter((position) => position.active), [allPositions]);

  const save = async () => {
    if (!restaurantId || !memberToEdit || editPositionId == null) {
      setError("Выберите должность");
      return;
    }

    const selectedPosition = allPositions.find((position) => position.id === editPositionId);
    if (!selectedPosition) {
      setError("Выберите должность");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (selectedPosition.level !== memberToEdit.role) {
        await updateRole(memberToEdit.id, selectedPosition.level);
      }
      await updatePosition(memberToEdit.id, selectedPosition.id);
      setMemberToEdit(null);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Не удалось сохранить должность");
    } finally {
      setSaving(false);
    }
  };

  const description = memberToEdit
    ? `Укажите должность для ${displayNameOf(memberToEdit)}. Доступны только активные должности ресторана.`
    : undefined;

  return {
    memberToEdit,
    editPositionId,
    setEditPositionId,
    saving,
    error,
    editOptions,
    description,
    open,
    close,
    save,
  };
}

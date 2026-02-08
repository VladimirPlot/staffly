import React from "react";

import Modal from "../../../shared/ui/Modal";
import Button from "../../../shared/ui/Button";
import Textarea from "../../../shared/ui/Textarea";
import type { MemberDto } from "../../employees/api";
import type { ScheduleData } from "../types";
import { buildMemberDisplayNameMap, memberDisplayName } from "../utils/names";

type Props = {
  open: boolean;
  onClose: () => void;
  schedule: ScheduleData;
  currentMember: MemberDto | null;
  members: MemberDto[];
  onSubmit: (payload: { day: string; toMemberId: number; reason?: string }) => Promise<void>;
};

function hasShift(schedule: ScheduleData, memberId: number, day: string): string | null {
  const value = schedule.cellValues[`${memberId}:${day}`];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const ShiftReplacementDialog: React.FC<Props> = ({ open, onClose, schedule, currentMember, members, onSubmit }) => {
  const [selectedDay, setSelectedDay] = React.useState<string>("");
  const [selectedMember, setSelectedMember] = React.useState<string>("");
  const [reason, setReason] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelectedDay("");
    setSelectedMember("");
    setReason("");
    setError(null);
    setSubmitting(false);
  }, [open]);

  const myShifts = React.useMemo(() => {
    if (!currentMember) return [] as { date: string; value: string; positionName: string | null }[];
    return schedule.days
      .map((day) => ({
        date: day.date,
        value: hasShift(schedule, currentMember.id, day.date),
      }))
      .filter((item) => item.value) as { date: string; value: string; positionName: string | null }[];
  }, [currentMember, schedule]);

  const candidateMembers = React.useMemo(() => {
    if (!currentMember) return [] as MemberDto[];
    return schedule.rows
      .filter((row) => row.positionId && schedule.config.positionIds.includes(row.positionId))
      .filter((row) => row.memberId !== currentMember.id)
      .filter((row) => (selectedDay ? !hasShift(schedule, row.memberId, selectedDay) : true))
      .map((row) => members.find((m) => m.id === row.memberId))
      .filter((item): item is MemberDto => Boolean(item));
  }, [currentMember, members, schedule, selectedDay]);

  const displayNames = React.useMemo(
    () => buildMemberDisplayNameMap(candidateMembers),
    [candidateMembers]
  );

  const handleSubmit = React.useCallback(async () => {
    if (!selectedDay) {
      setError("Выберите свою смену");
      return;
    }
    if (!selectedMember) {
      setError("Выберите сотрудника для замены");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ day: selectedDay, toMemberId: Number(selectedMember), reason: reason || undefined });
      onClose();
    } catch (e: any) {
      setError(e?.friendlyMessage || "Не удалось отправить запрос");
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, onClose, reason, selectedDay, selectedMember]);

  const formatLabel = React.useCallback(
    (item: { date: string; value: string | null }) => {
      const dateLabel = new Date(item.date).toLocaleDateString("ru-RU");
      return `${dateLabel} — ${item.value ?? ""}`;
    },
    []
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать замену"
      description="Передайте свою смену коллеге из этого графика."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-default">Моя смена</div>
          <select
            className="w-full rounded-2xl border border-subtle px-3 py-2 text-base"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
          >
            <option value="">Выберите день</option>
            {myShifts.map((item) => (
              <option key={item.date} value={item.date}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-default">Кто меня заменяет</div>
          <select
            className="w-full rounded-2xl border border-subtle px-3 py-2 text-base"
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            disabled={!selectedDay}
          >
            <option value="">Выберите сотрудника</option>
            {candidateMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {memberDisplayName(member, displayNames)}
              </option>
            ))}
          </select>
          {!selectedDay && <div className="text-xs text-muted">Сначала выберите день.</div>}
        </div>

        <div>
          <Textarea
            label="Причина (необязательно)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !myShifts.length}>
            {submitting ? "Отправка…" : "Отправить запрос"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ShiftReplacementDialog;

import React from "react";

import Modal from "../../../shared/ui/Modal";
import Button from "../../../shared/ui/Button";
import Textarea from "../../../shared/ui/Textarea";
import type { MemberDto } from "../../employees/api";
import type { ScheduleData } from "../types";
import { memberDisplayName } from "../utils/names";

type Props = {
  open: boolean;
  onClose: () => void;
  schedule: ScheduleData;
  currentMember: MemberDto | null;
  members: MemberDto[];
  onSubmit: (payload: { myDay: string; targetMemberId: number; targetDay: string; reason?: string }) => Promise<void>;
};

function hasShift(schedule: ScheduleData, memberId: number, day: string): string | null {
  const value = schedule.cellValues[`${memberId}:${day}`];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const ShiftSwapDialog: React.FC<Props> = ({ open, onClose, schedule, currentMember, members, onSubmit }) => {
  const [myDay, setMyDay] = React.useState<string>("");
  const [targetMemberId, setTargetMemberId] = React.useState<string>("");
  const [targetDay, setTargetDay] = React.useState<string>("");
  const [reason, setReason] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setMyDay("");
    setTargetMemberId("");
    setTargetDay("");
    setReason("");
    setError(null);
    setSubmitting(false);
  }, [open]);

  const myShifts = React.useMemo(() => {
    if (!currentMember) return [] as { date: string; value: string }[];
    return schedule.days
      .map((day) => ({
        date: day.date,
        value: hasShift(schedule, currentMember.id, day.date),
      }))
      .filter((item) => item.value) as { date: string; value: string }[];
  }, [currentMember, schedule]);

  const availableMembers = React.useMemo(() => {
    if (!currentMember) return [] as MemberDto[];
    return schedule.rows
      .filter((row) => row.positionId && schedule.config.positionIds.includes(row.positionId))
      .filter((row) => row.memberId !== currentMember.id)
      .map((row) => members.find((m) => m.id === row.memberId))
      .filter((item): item is MemberDto => Boolean(item));
  }, [currentMember, members, schedule]);

  const targetShifts = React.useMemo(() => {
    if (!targetMemberId) return [] as { date: string; value: string }[];
    const memberIdNum = Number(targetMemberId);
    return schedule.days
      .map((day) => ({ date: day.date, value: hasShift(schedule, memberIdNum, day.date) }))
      .filter((item) => item.value) as { date: string; value: string }[];
  }, [schedule, targetMemberId]);

  const validate = React.useCallback(() => {
    if (!myDay) {
      setError("Выберите свою смену");
      return false;
    }
    if (!targetMemberId) {
      setError("Выберите сотрудника для обмена");
      return false;
    }
    if (!targetDay) {
      setError("Выберите смену коллеги");
      return false;
    }

    const myMemberId = currentMember?.id;
    const targetId = Number(targetMemberId);
    if (!myMemberId) {
      setError("Не найден текущий сотрудник");
      return false;
    }

    if (!hasShift(schedule, myMemberId, myDay)) {
      setError("У вас нет смены в выбранный день");
      return false;
    }
    if (!hasShift(schedule, targetId, targetDay)) {
      setError("У коллеги нет смены в выбранный день");
      return false;
    }
    if (hasShift(schedule, myMemberId, targetDay)) {
      setError("У вас уже есть смена в день коллеги");
      return false;
    }
    if (hasShift(schedule, targetId, myDay)) {
      setError("У коллеги уже есть смена в ваш день");
      return false;
    }

    setError(null);
    return true;
  }, [currentMember?.id, myDay, schedule, targetDay, targetMemberId]);

  const handleSubmit = React.useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        myDay,
        targetMemberId: Number(targetMemberId),
        targetDay,
        reason: reason || undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Не удалось отправить запрос");
    } finally {
      setSubmitting(false);
    }
  }, [myDay, onClose, onSubmit, reason, targetDay, targetMemberId, validate]);

  const formatLabel = React.useCallback((item: { date: string; value: string | null }) => {
    const dateLabel = new Date(item.date).toLocaleDateString("ru-RU");
    return `${dateLabel} — ${item.value ?? ""}`;
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать обмен сменами"
      description="Поменяйтесь сменами с коллегой из этого графика."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-zinc-700">Моя смена</div>
          <select
            className="w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
            value={myDay}
            onChange={(e) => setMyDay(e.target.value)}
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
          <div className="text-sm font-medium text-zinc-700">С кем обменяться</div>
          <select
            className="w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
            value={targetMemberId}
            onChange={(e) => setTargetMemberId(e.target.value)}
            disabled={!myDay}
          >
            <option value="">Выберите сотрудника</option>
            {availableMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {memberDisplayName(member, schedule.config.showFullName)}
              </option>
            ))}
          </select>
          {!myDay && <div className="text-xs text-zinc-500">Сначала выберите свою смену.</div>}
        </div>

        {targetMemberId && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-700">Смена коллеги</div>
            <select
              className="w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
              value={targetDay}
              onChange={(e) => setTargetDay(e.target.value)}
            >
              <option value="">Выберите смену</option>
              {targetShifts.map((item) => (
                <option key={item.date} value={item.date}>
                  {formatLabel(item)}
                </option>
              ))}
            </select>
          </div>
        )}

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

export default ShiftSwapDialog;

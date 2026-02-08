import { useEffect, useMemo, useState } from "react";
import Modal from "../../../shared/ui/Modal";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import SelectField from "../../../shared/ui/SelectField";
import Button from "../../../shared/ui/Button";
import type { ReminderPeriodicity, ReminderRequest, ReminderTargetType } from "../api";
import type { PositionDto } from "../../dictionaries/api";
import type { MemberDto } from "../../employees/api";
import TimeSelect from "./TimeSelect";

type ReminderDialogInitial = {
  title: string;
  description?: string;
  visibleToAdmin?: boolean;
  targetType?: ReminderTargetType;
  targetPositionId?: number | null;
  targetMemberId?: number | null;
  periodicity: ReminderPeriodicity;
  time: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthlyLastDay?: boolean;
  onceDate?: string | null;
};

type ReminderDialogProps = {
  open: boolean;
  canManage: boolean;
  positions: PositionDto[];
  members: MemberDto[];
  currentMemberId?: number | null;
  initialData?: ReminderDialogInitial;
  submitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: ReminderRequest) => void;
};

const dayOptions = [
  { value: 1, label: "Понедельник" },
  { value: 2, label: "Вторник" },
  { value: 3, label: "Среда" },
  { value: 4, label: "Четверг" },
  { value: 5, label: "Пятница" },
  { value: 6, label: "Суббота" },
  { value: 7, label: "Воскресенье" },
];

function formatMemberName(member: MemberDto): string {
  if (member.fullName) return member.fullName;
  const first = member.firstName ?? "";
  const last = member.lastName ?? "";
  return `${first} ${last}`.trim() || member.phone || "Сотрудник";
}

const ReminderDialog = ({
  open,
  canManage,
  positions,
  members,
  currentMemberId,
  initialData,
  submitting,
  error,
  onClose,
  onSubmit,
}: ReminderDialogProps) => {
  const [targetSelection, setTargetSelection] = useState<"ALL" | "POSITION" | "ME">("ALL");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [periodicity, setPeriodicity] = useState<ReminderPeriodicity>(
    initialData?.periodicity ?? "DAILY"
  );
  const [hour, setHour] = useState<number | "">(
    initialData?.time ? Number(initialData.time.split(":")[0]) : ""
  );
  const [minute, setMinute] = useState<number | "">(
    initialData?.time ? Number(initialData.time.split(":")[1]) : ""
  );
  const [dayOfWeek, setDayOfWeek] = useState<number | "">(
    initialData?.dayOfWeek ?? ""
  );
  const [dayOfMonth, setDayOfMonth] = useState<number | "">(
    initialData?.dayOfMonth ?? ""
  );
  const [monthlyLastDay, setMonthlyLastDay] = useState<boolean>(
    initialData?.monthlyLastDay ?? false
  );
  const [onceDate, setOnceDate] = useState(initialData?.onceDate ?? "");
  const [visibleToAdmin, setVisibleToAdmin] = useState(
    initialData?.visibleToAdmin ?? true
  );
  const [positionId, setPositionId] = useState<number | null>(
    initialData?.targetPositionId ?? null
  );
  const [memberId, setMemberId] = useState<number | null>(
    initialData?.targetMemberId ?? null
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initialTargetType = initialData?.targetType;
    const isSelfTarget =
      initialTargetType === "MEMBER" &&
      Boolean(initialData?.targetMemberId) &&
      initialData?.targetMemberId === currentMemberId;
    setTargetSelection(
      initialTargetType === "ALL" ? "ALL" : isSelfTarget ? "ME" : "POSITION"
    );
    setTitle(initialData?.title ?? "");
    setDescription(initialData?.description ?? "");
    setPeriodicity(initialData?.periodicity ?? "DAILY");
    setHour(initialData?.time ? Number(initialData.time.split(":")[0]) : "");
    setMinute(initialData?.time ? Number(initialData.time.split(":")[1]) : "");
    setDayOfWeek(initialData?.dayOfWeek ?? "");
    setDayOfMonth(initialData?.dayOfMonth ?? "");
    setMonthlyLastDay(initialData?.monthlyLastDay ?? false);
    setOnceDate(initialData?.onceDate ?? "");
    setVisibleToAdmin(initialData?.visibleToAdmin ?? true);
    const resolvedMemberId = initialData?.targetMemberId ?? null;
    const resolvedPositionId =
      initialData?.targetPositionId ??
      members.find((member) => member.id === resolvedMemberId)?.positionId ??
      null;
    setPositionId(resolvedPositionId);
    setMemberId(isSelfTarget ? null : resolvedMemberId);
    setLocalError(null);
  }, [open, initialData, currentMemberId, members]);

  useEffect(() => {
    if (periodicity !== "MONTHLY") {
      if (monthlyLastDay) {
        setMonthlyLastDay(false);
      }
      return;
    }
    if (monthlyLastDay && Number(dayOfMonth) !== 31) {
      setDayOfMonth(31);
    }
  }, [periodicity, dayOfMonth, monthlyLastDay]);

  const todayIso = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const positionOptions = useMemo(
    () => [...positions].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [positions]
  );

  const filteredMembers = useMemo(() => {
    if (!positionId) return [];
    return members.filter((member) => member.positionId === positionId);
  }, [members, positionId]);

  const handleTargetChange = (value: string) => {
    if (!value) {
      setTargetSelection("ALL");
      setPositionId(null);
      setMemberId(null);
      return;
    }
    if (value === "me") {
      setTargetSelection("ME");
      setPositionId(null);
      setMemberId(null);
      return;
    }
    const id = Number(value);
    const resolvedId = Number.isNaN(id) ? null : id;
    setTargetSelection("POSITION");
    setPositionId(resolvedId);
    setMemberId(null);
  };

  const handleSubmit = () => {
    setLocalError(null);
    if (!title.trim()) {
      setLocalError("Название обязательно");
      return;
    }

    if (hour === "" || minute === "") {
      setLocalError("Укажите время");
      return;
    }

    if (periodicity === "WEEKLY" && (dayOfWeek === "" || dayOfWeek == null)) {
      setLocalError("Укажите день недели");
      return;
    }

    if (periodicity === "MONTHLY") {
      const day = typeof dayOfMonth === "number" ? dayOfMonth : Number(dayOfMonth);
      if (!day || Number.isNaN(day) || day < 1 || day > 31) {
        setLocalError("Укажите день месяца");
        return;
      }
    }

    if (periodicity === "ONCE" && !onceDate) {
      setLocalError("Укажите дату");
      return;
    }

    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    const time = `${hh}:${mm}`;

    let targetType: ReminderTargetType = "MEMBER";
    let targetPositionId: number | null = null;
    let targetMemberId: number | null = null;

    if (canManage) {
      if (targetSelection === "ALL") {
        targetType = "ALL";
      } else if (targetSelection === "ME") {
        if (!currentMemberId) {
          setLocalError("Не удалось определить текущего сотрудника");
          return;
        }
        targetType = "MEMBER";
        targetMemberId = currentMemberId;
      } else if (memberId) {
        targetType = "MEMBER";
        targetMemberId = memberId;
      } else {
        targetType = "POSITION";
        targetPositionId = positionId;
      }
    }

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      visibleToAdmin:
        canManage && targetSelection !== "ME" ? true : Boolean(visibleToAdmin),
      targetType,
      targetPositionId,
      targetMemberId,
      periodicity,
      time,
      dayOfWeek: typeof dayOfWeek === "number" ? dayOfWeek : undefined,
      dayOfMonth:
        periodicity === "MONTHLY"
          ? typeof dayOfMonth === "number"
            ? dayOfMonth
            : Number(dayOfMonth)
          : undefined,
      monthlyLastDay: periodicity === "MONTHLY" ? monthlyLastDay : undefined,
      onceDate: periodicity === "ONCE" ? onceDate : undefined,
    });
  };

  const effectiveError = error || localError;
  const showVisibilityToggle = !canManage || targetSelection === "ME";

  return (
    <Modal
      open={open}
      title={initialData ? "Редактировать напоминание" : "Новое напоминание"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Сохраняем…" : "Сохранить"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Название"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="Например, проверить поставку"
        />
        <Textarea
          label="Описание"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Опционально"
          rows={4}
        />

        {canManage ? (
          <SelectField
            label="Кому"
            value={
              targetSelection === "ALL"
                ? ""
                : targetSelection === "ME"
                  ? "me"
                  : positionId
                    ? String(positionId)
                    : ""
            }
            onChange={(event) => handleTargetChange(event.target.value)}
          >
            <option value="">Всем</option>
            <option value="me">Мне</option>
            {positionOptions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <SelectField label="Кому" value="me" onChange={() => undefined} disabled>
            <option value="me">Мне</option>
          </SelectField>
        )}

        {canManage && targetSelection === "POSITION" && positionId && (
          <SelectField
            label="Выберите сотрудника"
            value={memberId ? String(memberId) : "all"}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "all") {
                setMemberId(null);
              } else {
                setMemberId(Number(value));
              }
            }}
          >
            <option value="all">Всем</option>
            {filteredMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {formatMemberName(member)}
              </option>
            ))}
          </SelectField>
        )}

        {showVisibilityToggle && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={visibleToAdmin}
              onChange={(event) => setVisibleToAdmin(event.currentTarget.checked)}
            />
            Видно всем
          </label>
        )}

        <SelectField
          label="Периодичность"
          value={periodicity}
          onChange={(event) => setPeriodicity(event.target.value as ReminderPeriodicity)}
        >
          <option value="DAILY">Ежедневно</option>
          <option value="WEEKLY">Еженедельно</option>
          <option value="MONTHLY">Ежемесячно</option>
          <option value="ONCE">Один раз</option>
        </SelectField>

        <TimeSelect
          label="Время"
          hour={hour}
          minute={minute}
          onHourChange={setHour}
          onMinuteChange={setMinute}
        />

        {periodicity === "WEEKLY" && (
          <SelectField
            label="День недели"
            value={dayOfWeek === "" ? "" : String(dayOfWeek)}
            onChange={(event) => setDayOfWeek(Number(event.target.value))}
          >
            <option value="">--</option>
            {dayOptions.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </SelectField>
        )}

        {periodicity === "MONTHLY" && (
          <div className="space-y-2">
            <SelectField
              label="День месяца"
              value={dayOfMonth === "" ? "" : String(dayOfMonth)}
              onChange={(event) => {
                const value = Number(event.target.value);
                setDayOfMonth(value);
                if (monthlyLastDay && value !== 31) {
                  setMonthlyLastDay(false);
                }
              }}
            >
              <option value="">--</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={monthlyLastDay}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setMonthlyLastDay(checked);
                  if (checked) {
                    setDayOfMonth(31);
                  }
                }}
              />
              Последний день месяца
            </label>
          </div>
        )}

        {periodicity === "ONCE" && (
          <Input
            label="Дата"
            type="date"
            value={onceDate}
            onChange={(event) => setOnceDate(event.target.value)}
            min={todayIso}
          />
        )}

        {effectiveError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {effectiveError}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ReminderDialog;
export type { ReminderDialogInitial };

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import SelectField from "../../../shared/ui/SelectField";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import { listMembers, type MemberDto } from "../../employees/api";
import {
  createReminder,
  deleteReminder,
  listReminders,
  updateReminder,
  type ReminderDto,
  type ReminderRequest,
} from "../api";
import ReminderDialog, { type ReminderDialogInitial } from "./ReminderDialog";

const weekdays = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

type RestaurantRemindersProps = {
  restaurantId: number;
  canManage: boolean;
  currentUserId?: number | null;
};

const RestaurantReminders = ({
  restaurantId,
  canManage,
  currentUserId,
}: RestaurantRemindersProps) => {
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [reminders, setReminders] = useState<ReminderDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogInitial, setDialogInitial] = useState<ReminderDialogInitial | undefined>(undefined);
  const [editing, setEditing] = useState<ReminderDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReminderDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDictionaries = useCallback(async () => {
    if (!canManage || !restaurantId) {
      setPositions([]);
      setMembers([]);
      return;
    }
    try {
      const [positionsData, membersData] = await Promise.all([
        listPositions(restaurantId, { includeInactive: false }),
        listMembers(restaurantId),
      ]);
      setPositions(positionsData.filter((position) => position.active));
      setMembers(membersData);
    } catch (err) {
      console.error("Failed to load reminder dictionaries", err);
      setPositions([]);
      setMembers([]);
    }
  }, [restaurantId, canManage]);

  const loadReminders = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listReminders(
        restaurantId,
        canManage && positionFilter ? { positionId: positionFilter } : undefined
      );
      setReminders(data);
    } catch (err) {
      console.error("Failed to load reminders", err);
      setError("Не удалось загрузить напоминания");
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canManage, positionFilter]);

  useEffect(() => {
    void loadDictionaries();
  }, [loadDictionaries]);

  useEffect(() => {
    void loadReminders();
  }, [loadReminders]);

  const openCreateDialog = useCallback(() => {
    setEditing(null);
    setDialogError(null);
    setDialogInitial({
      title: "",
      description: "",
      visibleToAdmin: true,
      targetType: "ALL",
      periodicity: "DAILY",
      time: "09:00",
      dayOfWeek: 1,
      dayOfMonth: 1,
      monthlyLastDay: false,
      onceDate: "",
    });
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((reminder: ReminderDto) => {
    setEditing(reminder);
    setDialogError(null);
    setDialogInitial({
      title: reminder.title,
      description: reminder.description ?? "",
      visibleToAdmin: reminder.visibleToAdmin,
      targetType: reminder.targetType,
      targetPositionId: reminder.targetPosition?.id ?? null,
      targetMemberId: reminder.targetMember?.id ?? null,
      periodicity: reminder.periodicity,
      time: reminder.time,
      dayOfWeek: reminder.dayOfWeek ?? undefined,
      dayOfMonth: reminder.dayOfMonth ?? undefined,
      monthlyLastDay: reminder.monthlyLastDay,
      onceDate: reminder.onceDate ?? "",
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    if (dialogSubmitting) return;
    setDialogOpen(false);
    setEditing(null);
    setDialogError(null);
  }, [dialogSubmitting]);

  const handleSubmitDialog = useCallback(
    async (payload: ReminderRequest) => {
      if (!restaurantId) return;
      setDialogSubmitting(true);
      setDialogError(null);
      try {
        if (editing) {
          await updateReminder(restaurantId, editing.id, payload);
        } else {
          await createReminder(restaurantId, payload);
        }
        setDialogOpen(false);
        setEditing(null);
        await loadReminders();
      } catch (err: any) {
        console.error("Failed to save reminder", err);
        const message = err?.friendlyMessage || "Не удалось сохранить напоминание";
        setDialogError(message);
      } finally {
        setDialogSubmitting(false);
      }
    },
    [restaurantId, editing, loadReminders]
  );

  const openDeleteDialog = useCallback((reminder: ReminderDto) => {
    setDeleteTarget(reminder);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteReminder(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await loadReminders();
    } catch (err) {
      console.error("Failed to delete reminder", err);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, restaurantId, loadReminders]);

  const resolveTargetLabel = useCallback((reminder: ReminderDto) => {
    if (reminder.targetType === "ALL") {
      return "Всем";
    }
    if (reminder.targetType === "POSITION") {
      return reminder.targetPosition?.name ?? "Должность";
    }
    if (reminder.targetType === "MEMBER") {
      return reminder.targetMember?.fullName || "Сотрудник";
    }
    return "—";
  }, []);

  const resolvePeriodLabel = useCallback((reminder: ReminderDto) => {
    const time = reminder.time;
    switch (reminder.periodicity) {
      case "DAILY":
        return `Ежедневно в ${time}`;
      case "WEEKLY": {
        const index = reminder.dayOfWeek ? reminder.dayOfWeek - 1 : null;
        const dayLabel = index != null ? weekdays[index] : "день недели";
        return `Каждую неделю в ${dayLabel.toLowerCase()} в ${time}`;
      }
      case "MONTHLY":
        if (reminder.monthlyLastDay) {
          return `В последний день месяца в ${time}`;
        }
        return `Каждый месяц ${reminder.dayOfMonth} числа в ${time}`;
      case "ONCE":
        return `Один раз ${reminder.onceDate ?? ""} в ${time}`;
      default:
        return "";
    }
  }, []);

  const formatNextFire = useCallback((value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const positionFilterOptions = useMemo(
    () => [...positions].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [positions]
  );

  const currentMemberId = useMemo(() => {
    if (!currentUserId) return null;
    return members.find((member) => member.userId === currentUserId)?.id ?? null;
  }, [currentUserId, members]);

  const canEditReminder = useCallback(
    (reminder: ReminderDto) => {
      if (canManage) return true;
      if (!currentUserId) return false;
      return reminder.createdBy?.userId === currentUserId;
    },
    [canManage, currentUserId]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {canManage && positionFilterOptions.length > 0 && (
          <SelectField
            label="Фильтр по должности"
            value={positionFilter ? String(positionFilter) : ""}
            onChange={(event) => {
              const value = event.target.value;
              setPositionFilter(value ? Number(value) : null);
            }}
            className="max-w-xs"
          >
            <option value="">Все должности</option>
            {positionFilterOptions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </SelectField>
        )}
        <Button
          onClick={openCreateDialog}
          className="ml-auto self-end whitespace-nowrap"
          leftIcon={<Icon icon={Plus} size="sm" className="shrink-0" />}
        >
          Создать
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="text-sm text-muted">Загружаем напоминания…</Card>
      ) : reminders.length === 0 ? (
        <Card className="text-sm text-muted">Напоминаний пока нет.</Card>
      ) : (
        <div className="space-y-3">
          {reminders.map((reminder) => {
            const nextFireLabel = formatNextFire(reminder.nextFireAt);
            const canEdit = canEditReminder(reminder);
            return (
              <Card key={reminder.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-strong">{reminder.title}</div>
                    {reminder.description && (
                      <div className="mt-1 whitespace-pre-line text-sm text-muted">
                        {reminder.description}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-app px-3 py-1 text-default">
                        {resolveTargetLabel(reminder)}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                        {resolvePeriodLabel(reminder)}
                      </span>
                    </div>
                    {nextFireLabel && (
                      <div className="mt-2 text-xs text-muted">Следующее: {nextFireLabel}</div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(reminder)}
                        className="text-muted"
                        aria-label="Редактировать"
                      >
                        <Icon icon={Pencil} size="sm" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(reminder)}
                        className="text-red-600 hover:bg-red-50"
                        aria-label="Удалить"
                      >
                        <Icon icon={Trash2} size="sm" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ReminderDialog
        open={dialogOpen}
        canManage={canManage}
        positions={positions}
        members={members}
        currentMemberId={currentMemberId}
        initialData={dialogInitial}
        submitting={dialogSubmitting}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={handleSubmitDialog}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить напоминание?"
        description="Действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={() => void confirmDelete()}
        onCancel={closeDeleteDialog}
        confirming={deleting}
      />
    </div>
  );
};

export default RestaurantReminders;

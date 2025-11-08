import React from "react";

import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import { useAuth } from "../../../shared/providers/AuthProvider";

import CreateScheduleDialog from "../components/CreateScheduleDialog";
import ScheduleTable from "../components/ScheduleTable";
import {
  createSchedule,
  deleteSchedule,
  fetchSchedule,
  listSavedSchedules,
  updateSchedule,
  type ScheduleSummary,
} from "../api";
import type { ScheduleConfig, ScheduleData, ScheduleCellKey } from "../types";
import { daysBetween, formatDayNumber, formatWeekdayShort, monthLabelsBetween } from "../utils/date";
import { memberDisplayName } from "../utils/names";
import { normalizeCellValue } from "../utils/cellFormatting";
import { exportScheduleToJpeg, exportScheduleToXlsx } from "../utils/exporters";
import { fetchMyRoleIn, listMembers, type MemberDto } from "../../employees/api";
import { listPositions, type PositionDto, type RestaurantRole } from "../../dictionaries/api";
import { resolveRestaurantAccess } from "../../../shared/utils/access";

function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null;
  return role.toString().toUpperCase().replace(/^ROLE_/, "");
}

function buildTitle(positionNames: string[], monthNames: string[]): string {
  const positionsPart = positionNames.join(" - ");
  const monthsPart = monthNames.join("/");
  if (positionsPart && monthsPart) return `${positionsPart} - ${monthsPart}`;
  return positionsPart || monthsPart || "График";
}

function sortMembers(
  members: MemberDto[],
  positionOrder: Map<number, number>,
  showFullName: boolean
): MemberDto[] {
  return [...members].sort((a, b) => {
    const orderA = positionOrder.get(a.positionId ?? -1) ?? Number.MAX_SAFE_INTEGER;
    const orderB = positionOrder.get(b.positionId ?? -1) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    const nameA = memberDisplayName(a, showFullName).toLocaleLowerCase("ru-RU");
    const nameB = memberDisplayName(b, showFullName).toLocaleLowerCase("ru-RU");
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
}

const SchedulePage: React.FC = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [members, setMembers] = React.useState<MemberDto[]>([]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [schedule, setSchedule] = React.useState<ScheduleData | null>(null);
  const [savedSchedules, setSavedSchedules] = React.useState<ScheduleSummary[]>([]);
  const [selectedSavedId, setSelectedSavedId] = React.useState<number | null>(null);
  const [scheduleReadOnly, setScheduleReadOnly] = React.useState(false);
  const [scheduleLoading, setScheduleLoading] = React.useState(false);
  const [scheduleMessage, setScheduleMessage] = React.useState<string | null>(null);
  const [scheduleError, setScheduleError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [lastRange, setLastRange] = React.useState<{ start: string; end: string } | null>(null);
  const [downloading, setDownloading] = React.useState<{ id: number; type: "xlsx" | "jpg" } | null>(
    null
  );

  const scheduleId = schedule?.id ?? null;

  React.useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      setError("Не выбран ресторан");
      setMyRole(null);
      setPositions([]);
      setMembers([]);
      setSchedule(null);
      setSavedSchedules([]);
      setSelectedSavedId(null);
      setScheduleReadOnly(false);
      setScheduleLoading(false);
      setScheduleMessage(null);
      setScheduleError(null);
      setSaving(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);
    setSchedule(null);
    setSavedSchedules([]);
    setSelectedSavedId(null);
    setScheduleReadOnly(false);
    setScheduleMessage(null);
    setScheduleError(null);
    setScheduleLoading(false);
    setSaving(false);

    (async () => {
      try {
        const role = await fetchMyRoleIn(restaurantId);
        const accessNow = resolveRestaurantAccess(user?.roles, role);
        const [posList, memList, savedList] = await Promise.all([
          listPositions(restaurantId, { includeInactive: accessNow.isManagerLike }),
          listMembers(restaurantId),
          listSavedSchedules(restaurantId),
        ]);
        if (!alive) return;
        setMyRole(role);
        setPositions(posList);
        setMembers(memList);
        setSavedSchedules(savedList);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.response?.data?.message || e?.message || "Не удалось загрузить данные");
        setMyRole(null);
        setPositions([]);
        setMembers([]);
        setSavedSchedules([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId, user?.roles]);

  const access = React.useMemo(
    () => resolveRestaurantAccess(user?.roles, myRole),
    [user?.roles, myRole]
  );

  const normalizedUserRoles = React.useMemo(() => {
    const result = new Set<string>();
    user?.roles?.forEach((role) => {
      const normalized = normalizeRole(role);
      if (normalized) {
        result.add(normalized);
      }
    });
    return result;
  }, [user?.roles]);

  const normalizedMembershipRole = React.useMemo(() => {
    if (!user?.id) return normalizeRole(myRole);
    const member = members.find((item) => item.userId === user.id);
    return normalizeRole(member?.role ?? myRole);
  }, [members, myRole, user?.id]);

  const canManage = React.useMemo(() => {
    if (normalizedMembershipRole === "STAFF") {
      return false;
    }

    if (normalizedMembershipRole === "ADMIN" || normalizedMembershipRole === "MANAGER") {
      return true;
    }

    if (access.normalizedRestaurantRole === "STAFF") {
      return false;
    }

    if (access.isCreator) {
      return true;
    }

    const allowedRoles = ["CREATOR", "ADMIN", "MANAGER"] as const;

    if (allowedRoles.some((role) => normalizedUserRoles.has(role))) {
      return true;
    }

    return (
      access.normalizedRestaurantRole != null &&
      allowedRoles.some((role) => role === access.normalizedRestaurantRole)
    );
  }, [
    access.isCreator,
    access.normalizedRestaurantRole,
    normalizedMembershipRole,
    normalizedUserRoles,
  ]);

  React.useEffect(() => {
    if (!canManage) {
      setDialogOpen(false);
      setScheduleReadOnly(true);
    }
  }, [canManage]);

  const handleCreateSchedule = React.useCallback(
    (config: ScheduleConfig) => {
      if (!canManage) return;
      const dateList = daysBetween(config.startDate, config.endDate);
      const months = monthLabelsBetween(dateList);
      const selectedPositions = positions.filter((position) =>
        config.positionIds.includes(position.id)
      );
      const positionOrder = new Map<number, number>();
      config.positionIds.forEach((id, index) => {
        positionOrder.set(id, index);
      });

      const filteredMembers = members.filter(
        (member) => member.positionId != null && positionOrder.has(member.positionId)
      );
      const sortedMembers = sortMembers(filteredMembers, positionOrder, config.showFullName);

      const days = dateList.map((iso) => ({
        date: iso,
        weekdayLabel: formatWeekdayShort(iso),
        dayNumber: formatDayNumber(iso),
      }));

      const rows = sortedMembers.map((member) => ({
        id: undefined,
        memberId: member.id,
        member,
        displayName: memberDisplayName(member, config.showFullName),
        positionId: member.positionId,
        positionName: selectedPositions.find((p) => p.id === member.positionId)?.name ?? null,
      }));

      const title = buildTitle(
        selectedPositions.map((p) => p.name),
        months
      );

      setSchedule({
        id: undefined,
        title,
        config,
        days,
        rows,
        cellValues: {},
      });
      setScheduleReadOnly(false);
      setSelectedSavedId(null);
      setScheduleMessage(null);
      setScheduleError(null);
      setScheduleLoading(false);
      setLastRange({ start: config.startDate, end: config.endDate });
    },
    [canManage, members, positions]
  );

  const handleCellChange = React.useCallback(
    (key: ScheduleCellKey, value: string, options?: { commit?: boolean }) => {
      setSchedule((prev) => {
        if (!prev) return prev;
        const nextValues = { ...prev.cellValues };
        if (options?.commit) {
          const normalized = normalizeCellValue(value, prev.config.shiftMode);
          if (!normalized) {
            delete nextValues[key];
          } else {
            nextValues[key] = normalized;
          }
        } else {
          nextValues[key] = value;
        }
        return { ...prev, cellValues: nextValues };
      });
    },
    []
  );

  const handleSaveSchedule = React.useCallback(async () => {
    if (!canManage || !restaurantId || !schedule) return;
    setSaving(true);
    setScheduleMessage(null);
    setScheduleError(null);
    try {
      const normalizedCells: Record<string, string> = {};
      Object.entries(schedule.cellValues).forEach(([key, rawValue]) => {
        const normalized = normalizeCellValue(rawValue, schedule.config.shiftMode);
        if (normalized) {
          normalizedCells[key] = normalized;
        }
      });

      const payload = {
        title: schedule.title,
        config: schedule.config,
        rows: schedule.rows.map((row) => ({
          memberId: row.memberId,
          displayName: row.displayName,
          positionId: row.positionId ?? null,
          positionName: row.positionName ?? null,
        })),
        cellValues: normalizedCells,
      };

      const saved = schedule.id
        ? await updateSchedule(restaurantId, schedule.id, payload)
        : await createSchedule(restaurantId, payload);
      setSchedule(saved);
      setScheduleReadOnly(true);
      setSelectedSavedId(saved.id ?? null);
      setLastRange({ start: saved.config.startDate, end: saved.config.endDate });
      const savedList = await listSavedSchedules(restaurantId);
      setSavedSchedules(savedList);
      setScheduleMessage(schedule.id ? "График обновлён" : "График сохранён");
    } catch (e: any) {
      setScheduleError(e?.response?.data?.message || e?.message || "Не удалось сохранить график");
    } finally {
      setSaving(false);
    }
  }, [canManage, restaurantId, schedule]);

  const handleOpenSavedSchedule = React.useCallback(
    async (id: number) => {
      if (!restaurantId) return;
      setSelectedSavedId(id);
      setScheduleReadOnly(true);
      setScheduleLoading(true);
      setSchedule(null);
      setScheduleMessage(null);
      setScheduleError(null);
      try {
        const data = await fetchSchedule(restaurantId, id);
        setSchedule(data);
        setLastRange({ start: data.config.startDate, end: data.config.endDate });
      } catch (e: any) {
        setScheduleError(e?.response?.data?.message || e?.message || "Не удалось загрузить график");
      } finally {
        setScheduleLoading(false);
      }
    },
    [restaurantId]
  );

  const handleCloseSavedSchedule = React.useCallback(() => {
    setSchedule(null);
    setSelectedSavedId(null);
    setScheduleReadOnly(false);
    setScheduleMessage(null);
    setScheduleError(null);
    setScheduleLoading(false);
  }, []);

  const fetchScheduleForActions = React.useCallback(
    async (id: number) => {
      if (!restaurantId) {
        throw new Error("Не выбран ресторан");
      }
      if (schedule && schedule.id === id) {
        return schedule;
      }
      return await fetchSchedule(restaurantId, id);
    },
    [restaurantId, schedule]
  );

  const handleDownloadXlsx = React.useCallback(
    async (id: number) => {
      if (!restaurantId) {
        return;
      }
      setDownloading({ id, type: "xlsx" });
      try {
        const data = await fetchScheduleForActions(id);
        exportScheduleToXlsx(data);
      } catch (e: any) {
        console.error(e);
        const message =
          e?.response?.data?.message || e?.message || "Не удалось скачать график";
        setScheduleMessage(null);
        setScheduleError(message);
      } finally {
        setDownloading((prev) => (prev && prev.id === id ? null : prev));
      }
    },
    [fetchScheduleForActions, restaurantId]
  );

  const handleDownloadJpg = React.useCallback(
    async (id: number) => {
      if (!restaurantId) {
        return;
      }
      setDownloading({ id, type: "jpg" });
      try {
        const data = await fetchScheduleForActions(id);
        await exportScheduleToJpeg(data);
      } catch (e: any) {
        console.error(e);
        const message =
          e?.response?.data?.message || e?.message || "Не удалось скачать график";
        setScheduleMessage(null);
        setScheduleError(message);
      } finally {
        setDownloading((prev) => (prev && prev.id === id ? null : prev));
      }
    },
    [fetchScheduleForActions, restaurantId]
  );

  const handleEnterEditMode = React.useCallback(() => {
    if (!canManage) return;
    setScheduleReadOnly(false);
    setScheduleMessage(null);
    setScheduleError(null);
  }, [canManage]);

  const handleCancelEdit = React.useCallback(async () => {
    if (!restaurantId) return;
    if (!scheduleId) {
      handleCloseSavedSchedule();
      return;
    }
    setScheduleLoading(true);
    setScheduleError(null);
    setScheduleMessage(null);
    try {
      const data = await fetchSchedule(restaurantId, scheduleId);
      setSchedule(data);
      setScheduleReadOnly(true);
      setLastRange({ start: data.config.startDate, end: data.config.endDate });
    } catch (e: any) {
      setScheduleError(e?.response?.data?.message || e?.message || "Не удалось загрузить график");
    } finally {
      setScheduleLoading(false);
    }
  }, [handleCloseSavedSchedule, restaurantId, scheduleId]);

  const handleDeleteSchedule = React.useCallback(async () => {
    if (!canManage || !restaurantId || !scheduleId) return;
    if (!window.confirm("Удалить этот график? Действие нельзя отменить.")) {
      return;
    }
    setDeleting(true);
    setScheduleError(null);
    setScheduleMessage(null);
    try {
      await deleteSchedule(restaurantId, scheduleId);
      const savedList = await listSavedSchedules(restaurantId);
      setSavedSchedules(savedList);
      setSchedule(null);
      setSelectedSavedId(null);
      setScheduleReadOnly(false);
      setScheduleMessage("График удалён");
    } catch (e: any) {
      setScheduleError(e?.response?.data?.message || e?.message || "Не удалось удалить график");
    } finally {
      setDeleting(false);
    }
  }, [canManage, restaurantId, scheduleId]);

  const openDialog = React.useCallback(() => {
    setDialogOpen(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
  }, []);

  const monthFallback = React.useMemo(() => {
    if (!schedule) return null;
    const months = monthLabelsBetween(schedule.days.map((day) => day.date));
    if (months.length > 0) return months.join("/");
    return null;
  }, [schedule]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackToHome />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">График</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Создавайте и редактируйте графики для выбранных должностей.
          </p>
        </div>
        {canManage && (
          <Button onClick={openDialog}>Создать график</Button>
        )}
      </div>

      {loading && <Card>Загрузка…</Card>}
      {!loading && error && <Card className="text-red-600">{error}</Card>}

      {!loading && !error && (savedSchedules.length > 0 || !canManage) && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-700">Сохранённые графики</div>
              <div className="mt-1 text-xs text-zinc-500">
                {savedSchedules.length > 0
                  ? "Нажмите «Открыть», чтобы посмотреть график или скачайте файл."
                  : canManage
                  ? "Пока список пуст. Сохраните график, чтобы увидеть его здесь."
                  : "Пока нет сохранённых графиков. Дождитесь, когда менеджер добавит новый график."}
              </div>
            </div>
            {selectedSavedId && (
              <Button variant="ghost" onClick={handleCloseSavedSchedule}>
                Скрыть
              </Button>
            )}
          </div>
          {savedSchedules.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {savedSchedules.map((item) => {
                const isActive = selectedSavedId === item.id;
                const isOpening = scheduleLoading && selectedSavedId === item.id;
                const isDownloading = downloading?.id === item.id;
                const isDownloadingXlsx = isDownloading && downloading?.type === "xlsx";
                const isDownloadingJpg = isDownloading && downloading?.type === "jpg";
                return (
                  <div
                    key={item.id}
                    className={`flex h-full flex-col justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                      isActive
                        ? "border-black bg-zinc-50"
                        : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
                    }`}
                  >
                    <div>
                      <div className="font-medium text-zinc-800">{item.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {item.startDate} — {item.endDate}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleOpenSavedSchedule(item.id)}
                        disabled={isActive || isOpening}
                      >
                        {isOpening ? "Открывается…" : isActive ? "Открыт" : "Открыть"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDownloadXlsx(item.id)}
                        disabled={isDownloading}
                      >
                        {isDownloadingXlsx ? "Скачивание…" : "Скачать .xlsx"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDownloadJpg(item.id)}
                        disabled={isDownloading}
                      >
                        {isDownloadingJpg ? "Скачивание…" : "Скачать .jpg"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {!loading && !error && !canManage && savedSchedules.length === 0 && !schedule && !scheduleLoading && (
        <Card>
          <div className="text-sm text-zinc-600">
            Раздел доступен для просмотра. Как только менеджер сохранит график, он появится в списке выше.
          </div>
        </Card>
      )}

      {!loading && !error && canManage && !schedule && !scheduleLoading && (
        <Card>
          <div className="space-y-2 text-sm text-zinc-600">
            <p>Пока график не создан. Нажмите «Создать график», чтобы настроить таблицу.</p>
            <p>Диапазон может включать не более 32 дней.</p>
          </div>
        </Card>
      )}

      {!loading && !error && scheduleLoading && <Card>Загрузка сохранённого графика…</Card>}

      {!loading && !error && scheduleError && (
        <Card className="border-red-200 bg-red-50 text-red-700">{scheduleError}</Card>
      )}

      {!loading && !error && scheduleMessage && (
        <Card className="border-emerald-200 bg-emerald-50 text-emerald-700">{scheduleMessage}</Card>
      )}

      {canManage && schedule && !scheduleReadOnly && !loading && !error && !scheduleLoading && (
        <div className="flex flex-wrap justify-end gap-2">
          {scheduleId && (
            <Button
              variant="ghost"
              onClick={handleCancelEdit}
              disabled={saving}
              className={saving ? "cursor-not-allowed opacity-60" : ""}
            >
              Отменить
            </Button>
          )}
          <Button
            onClick={handleSaveSchedule}
            disabled={saving}
            className={saving ? "cursor-wait opacity-70" : ""}
          >
            {saving ? "Сохранение…" : scheduleId ? "Сохранить изменения" : "Сохранить график"}
          </Button>
        </div>
      )}

      {!loading && !error && schedule && !scheduleLoading && (
        <Card className="overflow-hidden">
          {scheduleReadOnly && (
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Просмотр сохранённого графика
            </div>
          )}
          {canManage && scheduleReadOnly && scheduleId && (
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={handleEnterEditMode} disabled={deleting}>
                Редактировать
              </Button>
              <Button
                variant="outline"
                onClick={handleDeleteSchedule}
                disabled={deleting}
                className={`border-red-200 text-red-600 hover:bg-red-50 ${
                  deleting ? "cursor-wait opacity-60" : ""
                }`}
              >
                {deleting ? "Удаление…" : "Удалить"}
              </Button>
            </div>
          )}
          {schedule.rows.length === 0 ? (
            <div className="text-sm text-zinc-600">
              В выбранных должностях пока нет сотрудников. Попробуйте выбрать другие должности.
            </div>
          ) : (
            <ScheduleTable data={schedule} onChange={handleCellChange} readOnly={scheduleReadOnly} />
          )}
          {schedule.rows.length > 0 && monthFallback && (
            <div className="mt-3 text-xs text-zinc-500">
              Период: {schedule.config.startDate} — {schedule.config.endDate} ({monthFallback})
            </div>
          )}
        </Card>
      )}

      <CreateScheduleDialog
        open={dialogOpen}
        onClose={closeDialog}
        positions={positions}
        defaultStart={lastRange?.start}
        defaultEnd={lastRange?.end}
        onSubmit={handleCreateSchedule}
      />
    </div>
  );
};

export default SchedulePage;

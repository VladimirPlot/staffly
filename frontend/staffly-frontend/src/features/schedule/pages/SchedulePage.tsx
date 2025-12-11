import React from "react";

import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import { useAuth } from "../../../shared/providers/AuthProvider";

import CreateScheduleDialog from "../components/CreateScheduleDialog";
import ScheduleTable from "../components/ScheduleTable";
import ShiftReplacementDialog from "../components/ShiftReplacementDialog";
import ShiftSwapDialog from "../components/ShiftSwapDialog";
import {
  createSchedule,
  createReplacement,
  createSwap,
  decideAsManager,
  deleteSchedule,
  fetchSchedule,
  listSavedSchedules,
  listShiftRequests,
  cancelShiftRequest,
  updateSchedule,
  type ScheduleSummary,
  type ShiftRequestDto,
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
  const [replacementOpen, setReplacementOpen] = React.useState(false);
  const [swapOpen, setSwapOpen] = React.useState(false);
  const [shiftRequests, setShiftRequests] = React.useState<ShiftRequestDto[]>([]);
  const [shiftRequestsLoading, setShiftRequestsLoading] = React.useState(false);
  const [shiftRequestsError, setShiftRequestsError] = React.useState<string | null>(null);
  const [positionFilter, setPositionFilter] = React.useState<number | "all">("all");
  const [activeTab, setActiveTab] = React.useState<"today" | "table" | "requests">("table");
  const [downloadMenuFor, setDownloadMenuFor] = React.useState<number | null>(null);

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
      setShiftRequests([]);
      setShiftRequestsError(null);
      setShiftRequestsLoading(false);
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
    setShiftRequests([]);
    setShiftRequestsError(null);
    setShiftRequestsLoading(false);

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
        setError(e?.friendlyMessage || "Не удалось загрузить данные");
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

  const currentMember = React.useMemo(() => {
    if (!user?.id) return null;
    return members.find((item) => item.userId === user.id) ?? null;
  }, [members, user?.id]);

  const currentMemberInSchedule = React.useMemo(() => {
    if (!schedule || !currentMember) return false;
    return schedule.rows.some((row) => row.memberId === currentMember.id);
  }, [currentMember, schedule]);

  const hasMyShift = React.useMemo(() => {
    if (!schedule || !currentMember || !currentMemberInSchedule) return false;
    return schedule.days.some((day) => {
      const value = schedule.cellValues[`${currentMember.id}:${day.date}`];
      return Boolean(value && value.trim());
    });
  }, [currentMember, currentMemberInSchedule, schedule]);

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

  const loadShiftRequests = React.useCallback(
    async (targetScheduleId?: number) => {
      if (!restaurantId || !(targetScheduleId ?? scheduleId)) {
        setShiftRequests([]);
        return;
      }
      const scheduleForLoad = targetScheduleId ?? scheduleId;
      setShiftRequestsLoading(true);
      setShiftRequestsError(null);
      try {
        const data = await listShiftRequests(restaurantId, scheduleForLoad as number);
        setShiftRequests(data);
      } catch (e: any) {
        setShiftRequestsError(e?.friendlyMessage || "Не удалось загрузить заявки");
        setShiftRequests([]);
      } finally {
        setShiftRequestsLoading(false);
      }
    },
    [restaurantId, scheduleId]
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
      await loadShiftRequests(saved.id ?? undefined);
      setScheduleMessage(schedule.id ? "График обновлён" : "График сохранён");
    } catch (e: any) {
      setScheduleError(e?.friendlyMessage || "Не удалось сохранить график");
    } finally {
      setSaving(false);
    }
  }, [canManage, loadShiftRequests, restaurantId, schedule]);

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
        await loadShiftRequests(id);
      } catch (e: any) {
        setScheduleError(e?.friendlyMessage || "Не удалось загрузить график");
      } finally {
        setScheduleLoading(false);
      }
    },
    [loadShiftRequests, restaurantId]
  );

  const handleCloseSavedSchedule = React.useCallback(() => {
    setSchedule(null);
    setSelectedSavedId(null);
    setScheduleReadOnly(false);
    setScheduleMessage(null);
    setScheduleError(null);
    setScheduleLoading(false);
    setShiftRequests([]);
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
        const message = e?.friendlyMessage || "Не удалось скачать график";
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
        const message = e?.friendlyMessage || "Не удалось скачать график";
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
      await loadShiftRequests(scheduleId);
    } catch (e: any) {
      setScheduleError(e?.friendlyMessage || "Не удалось загрузить график");
    } finally {
      setScheduleLoading(false);
    }
  }, [handleCloseSavedSchedule, loadShiftRequests, restaurantId, scheduleId]);

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
      setShiftRequests([]);
      setScheduleMessage("График удалён");
    } catch (e: any) {
      setScheduleError(e?.friendlyMessage || "Не удалось удалить график");
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

  const handleOpenReplacement = React.useCallback(() => {
    setReplacementOpen(true);
  }, []);

  const handleCloseReplacement = React.useCallback(() => {
    setReplacementOpen(false);
  }, []);

  const handleOpenSwap = React.useCallback(() => {
    setSwapOpen(true);
  }, []);

  const handleCloseSwap = React.useCallback(() => {
    setSwapOpen(false);
  }, []);

  const handleSubmitReplacement = React.useCallback(
    async (payload: { day: string; toMemberId: number; reason?: string }) => {
      if (!restaurantId || !scheduleId) return;
      setScheduleError(null);
      setScheduleMessage(null);
    try {
      await createReplacement(restaurantId, scheduleId, payload);
      setScheduleMessage("Заявка на замену отправлена");
      setReplacementOpen(false);
      await loadShiftRequests();
    } catch (e: any) {
      setScheduleError(e?.friendlyMessage || "Не удалось создать заявку на замену");
    }
  },
  [loadShiftRequests, restaurantId, scheduleId]
);

  const handleSubmitSwap = React.useCallback(
    async (payload: { myDay: string; targetMemberId: number; targetDay: string; reason?: string }) => {
      if (!restaurantId || !scheduleId) return;
      setScheduleError(null);
      setScheduleMessage(null);
    try {
      await createSwap(restaurantId, scheduleId, payload);
      setScheduleMessage("Заявка на обмен отправлена");
      setSwapOpen(false);
      await loadShiftRequests();
    } catch (e: any) {
      setScheduleError(e?.friendlyMessage || "Не удалось создать заявку на обмен");
    }
  },
  [loadShiftRequests, restaurantId, scheduleId]
);

  const handleManagerDecision = React.useCallback(
    async (requestId: number, accepted: boolean) => {
      if (!restaurantId || !scheduleId) return;
      setScheduleError(null);
      setScheduleMessage(null);
    try {
      await decideAsManager(restaurantId, scheduleId, requestId, accepted);
      const data = await fetchSchedule(restaurantId, scheduleId);
      setSchedule(data);
      setScheduleReadOnly(true);
      setLastRange({ start: data.config.startDate, end: data.config.endDate });
      await loadShiftRequests(scheduleId);
      setScheduleMessage(accepted ? "Заявка одобрена" : "Заявка отклонена");
    } catch (e: any) {
      setScheduleError(e?.friendlyMessage || "Не удалось обработать заявку");
    }
  },
  [decideAsManager, fetchSchedule, loadShiftRequests, restaurantId, scheduleId]
);

  const handleCancelMyShiftRequest = React.useCallback(
    async (requestId: number) => {
      if (!restaurantId || !scheduleId) return;
      setScheduleError(null);
      setScheduleMessage(null);
    try {
      await cancelShiftRequest(restaurantId, scheduleId, requestId);
      await loadShiftRequests();
      const savedList = await listSavedSchedules(restaurantId);
      setSavedSchedules(savedList);
      setScheduleMessage("Заявка отменена");
    } catch (e: any) {
      setScheduleError(e?.friendlyMessage || "Не удалось отменить заявку");
    }
  },
  [restaurantId, scheduleId, loadShiftRequests]
);

  const monthFallback = React.useMemo(() => {
    if (!schedule) return null;
    const months = monthLabelsBetween(schedule.days.map((day) => day.date));
    if (months.length > 0) return months.join("/");
    return null;
  }, [schedule]);

  const canCreateShiftRequest = React.useMemo(
    () => Boolean(schedule && scheduleId && currentMember && currentMemberInSchedule && hasMyShift),
    [currentMember, currentMemberInSchedule, hasMyShift, schedule, scheduleId]
  );

  const hasPendingSavedSchedules = React.useMemo(
    () => savedSchedules.some((item) => item.hasPendingShiftRequests),
    [savedSchedules]
  );

  const shiftDisplay = React.useCallback(
    (memberId: number, day: string | null) => {
      if (!schedule || !day) return day ?? "";
      const value = schedule.cellValues[`${memberId}:${day}`];
      if (value) {
        return `${day} (${value})`;
      }
      return day;
    },
    [schedule]
  );

  const humanStatus = React.useCallback((status: ShiftRequestDto["status"]) => {
    switch (status) {
      case "PENDING_MANAGER":
        return "Ожидает решения менеджера";
      case "APPROVED":
        return "Одобрено";
      case "REJECTED_BY_MANAGER":
        return "Отклонено";
      default:
        return status;
    }
  }, []);

  const canCancelOwnRequest = React.useCallback(
    (request: ShiftRequestDto) => {
      if (!currentMember) return false;
      if (request.status !== "PENDING_MANAGER") return false;
      return request.fromMember.id === currentMember.id;
    },
    [currentMember]
  );

  const sortedSavedSchedules = React.useMemo(() => {
    return [...savedSchedules].sort((a, b) => {
      const endA = new Date(a.endDate).getTime();
      const endB = new Date(b.endDate).getTime();
      return endB - endA;
    });
  }, [savedSchedules]);

  const filteredSavedSchedules = React.useMemo(() => {
    if (!canManage || positionFilter === "all") {
      return sortedSavedSchedules;
    }
    return sortedSavedSchedules.filter((item) => item.positionIds?.includes(positionFilter));
  }, [canManage, positionFilter, sortedSavedSchedules]);

  const todayIso = React.useMemo(() => new Date().toISOString().split("T")[0], []);

  const todaysShifts = React.useMemo(() => {
    if (!schedule) return [] as { memberId: number; displayName: string; shift: string }[];
    const hasToday = schedule.days.some((day) => day.date === todayIso);
    if (!hasToday) return [] as { memberId: number; displayName: string; shift: string }[];

    return schedule.rows
      .map((row) => {
        const value = schedule.cellValues[`${row.memberId}:${todayIso}`];
        return {
          memberId: row.memberId,
          displayName: row.displayName,
          shift: value?.trim() ?? "",
        };
      })
      .filter((item) => Boolean(item.shift)) as {
      memberId: number;
      displayName: string;
      shift: string;
    }[];
  }, [schedule, todayIso]);

  const hasTodayShifts = todaysShifts.length > 0;

  React.useEffect(() => {
    if (!schedule) {
      setActiveTab("table");
      return;
    }
    setActiveTab(hasTodayShifts ? "today" : "table");
  }, [hasTodayShifts, schedule?.id]);

  const sortedShiftRequests = React.useMemo(() => {
    let requests = [...shiftRequests];
    if (!canManage && currentMember) {
      requests = requests.filter(
        (request) =>
          request.fromMember.id === currentMember.id || request.toMember.id === currentMember.id
      );
    }
    return requests.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [canManage, currentMember, shiftRequests]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackToHome />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Графики</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Создавайте и редактируйте графики для выбранных должностей.
          </p>
        </div>
        {canManage && (
          <Button onClick={openDialog} disabled={loading}>
            Создать график
          </Button>
        )}
      </div>

      {loading && <Card>Загрузка…</Card>}
      {!loading && error && <Card className="text-red-600">{error}</Card>}
      {!loading && !error && scheduleLoading && <Card>Загрузка сохранённого графика…</Card>}
      {!loading && !error && scheduleError && (
        <Card className="border-red-200 bg-red-50 text-red-700">{scheduleError}</Card>
      )}
      {!loading && !error && scheduleMessage && (
        <Card className="border-emerald-200 bg-emerald-50 text-emerald-700">{scheduleMessage}</Card>
      )}

      {!loading && !error && !schedule && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <span>Сохранённые графики</span>
                {hasPendingSavedSchedules && (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                    aria-label="Есть необработанные заявки"
                  />
                )}
              </div>
              <div className="text-xs text-zinc-500">
                {filteredSavedSchedules.length > 0
                  ? "Нажмите «Открыть», чтобы посмотреть график или скачайте файл."
                  : canManage
                  ? "Пока список пуст. Сохраните график, чтобы увидеть его здесь."
                  : "Пока нет сохранённых графиков. Дождитесь, когда менеджер добавит новый график."}
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <span>Должность:</span>
                <select
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 focus:border-black focus:outline-none"
                  value={positionFilter}
                  onChange={(e) =>
                    setPositionFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                  }
                >
                  <option value="all">Все</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {filteredSavedSchedules.length > 0 && (
            <Card>
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredSavedSchedules.map((item) => {
                  const isActive = selectedSavedId === item.id;
                  const isOpening = scheduleLoading && selectedSavedId === item.id;
                  const isDownloading = downloading?.id === item.id;
                  const menuOpen = downloadMenuFor === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`relative flex h-full flex-col justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                        isActive
                          ? "border-black bg-zinc-50"
                          : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
                      }`}
                    >
                      {item.hasPendingShiftRequests && (
                        <span
                          className="absolute right-2 top-2 inline-block h-2 w-2 rounded-full bg-emerald-500"
                          aria-label="Есть необработанные заявки"
                        />
                      )}
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
                        <div className="relative">
                          <Button
                            variant="outline"
                            onClick={() => setDownloadMenuFor(menuOpen ? null : item.id)}
                            disabled={isDownloading}
                          >
                            Скачать
                          </Button>
                          {menuOpen && (
                            <div className="absolute right-0 z-10 mt-2 w-36 rounded-xl border border-zinc-200 bg-white shadow-lg">
                              <button
                                className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                                onClick={() => {
                                  handleDownloadXlsx(item.id);
                                  setDownloadMenuFor(null);
                                }}
                              >
                                Скачать .xlsx
                              </button>
                              <button
                                className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                                onClick={() => {
                                  handleDownloadJpg(item.id);
                                  setDownloadMenuFor(null);
                                }}
                              >
                                Скачать .jpg
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {!loading && !error && !canManage && filteredSavedSchedules.length === 0 && !schedule && !scheduleLoading && (
        <Card>
          <div className="text-sm text-zinc-600">
            Раздел доступен для просмотра. Как только менеджер сохранит график, он появится в списке выше.
          </div>
        </Card>
      )}

      {!loading && !error && canManage && filteredSavedSchedules.length === 0 && !schedule && !scheduleLoading && (
        <Card>
          <div className="space-y-2 text-sm text-zinc-600">
            <p>Пока график не создан. Нажмите «Создать график», чтобы настроить таблицу.</p>
            <p>Диапазон может включать не более 32 дней.</p>
          </div>
        </Card>
      )}

      {!loading && !error && schedule && !scheduleLoading && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Button variant="ghost" onClick={handleCloseSavedSchedule}>
                ← Ко всем графикам
              </Button>
              <div className="space-y-1">
                <div className="text-xl font-semibold text-zinc-900">{schedule.title}</div>
                <div className="text-sm text-zinc-600">
                  {schedule.config.startDate} — {schedule.config.endDate}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && scheduleReadOnly && scheduleId && (
                <>
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
                </>
              )}
              {canManage && scheduleId && (
                <div className="relative">
                  <Button
                    variant="outline"
                    onClick={() => setDownloadMenuFor(downloadMenuFor === scheduleId ? null : scheduleId)}
                    disabled={Boolean(downloading)}
                  >
                    Скачать
                  </Button>
                  {downloadMenuFor === scheduleId && (
                    <div className="absolute right-0 z-10 mt-2 w-36 rounded-xl border border-zinc-200 bg-white shadow-lg">
                      <button
                        className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                        onClick={() => {
                          handleDownloadXlsx(scheduleId);
                          setDownloadMenuFor(null);
                        }}
                      >
                        Скачать .xlsx
                      </button>
                      <button
                        className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                        onClick={() => {
                          handleDownloadJpg(scheduleId);
                          setDownloadMenuFor(null);
                        }}
                      >
                        Скачать .jpg
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!canManage && canCreateShiftRequest && (
                <>
                  <Button variant="outline" onClick={handleOpenReplacement}>
                    Создать замену
                  </Button>
                  <Button variant="outline" onClick={handleOpenSwap}>
                    Создать обмен сменами
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-zinc-200 text-sm font-medium text-zinc-700">
            <button
              className={`rounded-t-xl px-4 py-2 transition ${
                activeTab === "today"
                  ? "border-b-2 border-black text-black"
                  : hasTodayShifts
                  ? "text-zinc-600 hover:text-black"
                  : "cursor-not-allowed text-zinc-400"
              }`}
              disabled={!hasTodayShifts}
              onClick={() => hasTodayShifts && setActiveTab("today")}
            >
              Состав сегодня
            </button>
            <button
              className={`rounded-t-xl px-4 py-2 transition ${
                activeTab === "table" ? "border-b-2 border-black text-black" : "text-zinc-600 hover:text-black"
              }`}
              onClick={() => setActiveTab("table")}
            >
              График
            </button>
            <button
              className={`rounded-t-xl px-4 py-2 transition ${
                activeTab === "requests"
                  ? "border-b-2 border-black text-black"
                  : "text-zinc-600 hover:text-black"
              }`}
              onClick={() => setActiveTab("requests")}
            >
              Заявки
            </button>
          </div>

          {activeTab === "today" && hasTodayShifts && (
            <Card className="space-y-3">
              <div className="text-lg font-semibold text-zinc-900">Сегодня по этому графику работают:</div>
              <div className="space-y-2 text-sm text-zinc-700">
                {todaysShifts.map((item) => (
                  <div
                    key={item.memberId}
                    className={
                      currentMember && item.memberId === currentMember.id ? "font-semibold text-zinc-900" : ""
                    }
                  >
                    {item.displayName} — {item.shift}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === "table" && (
            <>
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

              <Card className="overflow-hidden">
                {scheduleReadOnly && (
                  <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Просмотр сохранённого графика
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
            </>
          )}

          {activeTab === "requests" && (
            <div className="space-y-3">
              <div className="text-lg font-semibold text-zinc-900">
                {canManage ? "Заявки по этому графику" : "Мои заявки по этому графику"}
              </div>
              {shiftRequestsLoading && <Card>Заявки на смены загружаются…</Card>}
              {!shiftRequestsLoading && shiftRequestsError && (
                <Card className="border-red-200 bg-red-50 text-red-700">{shiftRequestsError}</Card>
              )}
              {!shiftRequestsLoading && !shiftRequestsError && sortedShiftRequests.length === 0 && (
                <Card>Пока нет заявок по этому графику.</Card>
              )}
              {!shiftRequestsLoading && !shiftRequestsError && sortedShiftRequests.length > 0 && (
                <div className="space-y-3">
                  {sortedShiftRequests.map((request) => (
                    <Card key={request.id} className="border-zinc-200">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1 text-sm text-zinc-700">
                          <div className="flex flex-wrap items-center gap-2 font-medium text-zinc-900">
                            <span>{request.type === "REPLACEMENT" ? "Замена" : "Обмен сменами"}</span>
                            <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-normal text-zinc-700">
                              {humanStatus(request.status)}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-600">
                            {request.type === "REPLACEMENT" ? "От" : "Первый"}: {request.fromMember.displayName}
                            {request.dayFrom && (
                              <>
                                {" "}• {shiftDisplay(request.fromMember.id, request.dayFrom)}
                              </>
                            )}
                          </div>
                          <div className="text-xs text-zinc-600">
                            {request.type === "REPLACEMENT" ? "Кому" : "Ворой"}: {request.toMember.displayName}
                            {request.dayTo && (
                              <>
                                {" "}• {shiftDisplay(request.toMember.id, request.dayTo)}
                              </>
                            )}
                            {request.type === "REPLACEMENT" && request.dayFrom && !request.dayTo && (
                              <>
                                {" "}• {shiftDisplay(request.toMember.id, request.dayFrom)}
                              </>
                            )}
                          </div>
                          {request.reason && (
                            <div className="text-xs text-zinc-600">Причина: {request.reason}</div>
                          )}
                          <div className="text-xs text-zinc-500">Создано: {new Date(request.createdAt).toLocaleString("ru-RU")}</div>
                        </div>
                        {((canManage && request.status === "PENDING_MANAGER") ||
                          canCancelOwnRequest(request)) && (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            {canManage && request.status === "PENDING_MANAGER" && (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() => handleManagerDecision(request.id, true)}
                                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                >
                                  Подтвердить
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleManagerDecision(request.id, false)}
                                  className="border-red-200 text-red-700 hover:bg-red-50"
                                >
                                  Отказать
                                </Button>
                              </>
                            )}

                            {canCancelOwnRequest(request) && (
                              <Button
                                variant="outline"
                                onClick={() => handleCancelMyShiftRequest(request.id)}
                                className="border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                              >
                                Отменить заявку
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {schedule && currentMember && (
        <>
          <ShiftReplacementDialog
            open={replacementOpen}
            onClose={handleCloseReplacement}
            schedule={schedule}
            currentMember={currentMember}
            members={members}
            onSubmit={handleSubmitReplacement}
          />
          <ShiftSwapDialog
            open={swapOpen}
            onClose={handleCloseSwap}
            schedule={schedule}
            currentMember={currentMember}
            members={members}
            onSubmit={handleSubmitSwap}
          />
        </>
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

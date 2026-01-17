import React from "react";

import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import { useAuth } from "../../../shared/providers/AuthProvider";

import { ArrowLeft } from "lucide-react";
import Icon from "../../../shared/ui/Icon";

import CreateScheduleDialog from "../components/CreateScheduleDialog";
import SavedSchedulesSection from "../components/SavedSchedulesSection";
import ScheduleDetailHeader from "../components/ScheduleDetailHeader";
import ScheduleTableSection from "../components/ScheduleTableSection";
import ScheduleTabsNav from "../components/ScheduleTabsNav";
import ShiftReplacementDialog from "../components/ShiftReplacementDialog";
import ShiftRequestsSection from "../components/ShiftRequestsSection";
import ShiftSwapDialog from "../components/ShiftSwapDialog";
import TodayShiftsCard from "../components/TodayShiftsCard";
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
import { buildMemberDisplayNameMap, memberDisplayName } from "../utils/names";
import { normalizeCellValue } from "../utils/cellFormatting";
import { hasStartWithoutEndValue } from "../utils/timeValues";
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
  displayNames: Record<number, string>
): MemberDto[] {
  return [...members].sort((a, b) => {
    const orderA = positionOrder.get(a.positionId ?? -1) ?? Number.MAX_SAFE_INTEGER;
    const orderB = positionOrder.get(b.positionId ?? -1) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    const nameA = memberDisplayName(a, displayNames).toLocaleLowerCase("ru-RU");
    const nameB = memberDisplayName(b, displayNames).toLocaleLowerCase("ru-RU");
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
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
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

  const autoTabDoneRef = React.useRef(false);

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
      setDeletingId(null);
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

      autoTabDoneRef.current = false;

      const normalizedConfig: ScheduleConfig = {
        ...config,
        showFullName: false,
        shiftMode: "FULL",
      };
      const dateList = daysBetween(config.startDate, config.endDate);
      const months = monthLabelsBetween(dateList);
      const selectedPositions = positions.filter((position) =>
        normalizedConfig.positionIds.includes(position.id)
      );
      const positionOrder = new Map<number, number>();
      normalizedConfig.positionIds.forEach((id, index) => {
        positionOrder.set(id, index);
      });

      const filteredMembers = members.filter(
        (member) => member.positionId != null && positionOrder.has(member.positionId)
      );
      const displayNames = buildMemberDisplayNameMap(filteredMembers);
      const sortedMembers = sortMembers(filteredMembers, positionOrder, displayNames);

      const days = dateList.map((iso) => ({
        date: iso,
        weekdayLabel: formatWeekdayShort(iso),
        dayNumber: formatDayNumber(iso),
      }));

      const rows = sortedMembers.map((member) => ({
        id: undefined,
        memberId: member.id,
        member,
        displayName: memberDisplayName(member, displayNames),
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
        config: normalizedConfig,
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

  const prepareSchedule = React.useCallback(
    (data: ScheduleData): ScheduleData => {
      const memberMap = new Map(members.map((item) => [item.id, item] as const));

      const uniqueMembers = new Map<number, MemberDto>();
      data.rows.forEach((row) => {
        const candidate = row.member ?? memberMap.get(row.memberId);
        if (candidate) {
          uniqueMembers.set(candidate.id, candidate);
        }
      });

      const displayNames = buildMemberDisplayNameMap(Array.from(uniqueMembers.values()));

      const rows = data.rows.map((row) => {
        const member = row.member ?? memberMap.get(row.memberId) ?? undefined;
        return {
          ...row,
          member,
          displayName: displayNames[row.memberId] ?? row.displayName,
        };
      });

      return {
        ...data,
        config: { ...data.config, showFullName: false, shiftMode: "FULL" },
        rows,
      };
    },
    [members]
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
      if (schedule.config.shiftMode === "FULL") {
        const hasIncompleteShifts = Object.values(schedule.cellValues).some((value) =>
          hasStartWithoutEndValue(value)
        );

        if (hasIncompleteShifts) {
          setScheduleError("Нельзя создать график без времени окончания смены сотрудника");
          setSaving(false);
          return;
        }
      }

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
      setSchedule(prepareSchedule(saved));
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
  }, [canManage, loadShiftRequests, prepareSchedule, restaurantId, schedule]);

  const handleOpenSavedSchedule = React.useCallback(
    async (id: number) => {
      if (!restaurantId) return;

      autoTabDoneRef.current = false;

      setSelectedSavedId(id);
      setScheduleReadOnly(true);
      setScheduleLoading(true);
      setSchedule(null);
      setScheduleMessage(null);
      setScheduleError(null);
      try {
        const data = await fetchSchedule(restaurantId, id);
        const prepared = prepareSchedule(data);
        setSchedule(prepared);
        setLastRange({ start: prepared.config.startDate, end: prepared.config.endDate });
        await loadShiftRequests(id);
      } catch (e: any) {
        setScheduleError(e?.friendlyMessage || "Не удалось загрузить график");
      } finally {
        setScheduleLoading(false);
      }
    },
    [loadShiftRequests, prepareSchedule, restaurantId]
  );

  const handleEditSavedSchedule = React.useCallback(
    async (id: number) => {
      if (!restaurantId || !canManage) return;

      autoTabDoneRef.current = false;

      setSelectedSavedId(id);
      setScheduleReadOnly(false);
      setScheduleLoading(true);
      setSchedule(null);
      setScheduleMessage(null);
      setScheduleError(null);
      try {
        const data = await fetchSchedule(restaurantId, id);
        const prepared = prepareSchedule(data);
        setSchedule(prepared);
        setLastRange({ start: prepared.config.startDate, end: prepared.config.endDate });
        await loadShiftRequests(id);
      } catch (e: any) {
        setScheduleError(e?.friendlyMessage || "Не удалось загрузить график");
      } finally {
        setScheduleLoading(false);
      }
    },
    [canManage, loadShiftRequests, prepareSchedule, restaurantId]
  );

  const handleCloseSavedSchedule = React.useCallback(() => {
    setSchedule(null);
    setSelectedSavedId(null);
    setScheduleReadOnly(false);
    setScheduleMessage(null);
    setScheduleError(null);
    setScheduleLoading(false);
    setShiftRequests([]);

    autoTabDoneRef.current = false;
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
      const prepared = prepareSchedule(data);
      setSchedule(prepared);
      setScheduleReadOnly(true);
      setLastRange({ start: prepared.config.startDate, end: prepared.config.endDate });
      await loadShiftRequests(scheduleId);
    } catch (e: any) {
      setScheduleError(e?.friendlyMessage || "Не удалось загрузить график");
    } finally {
      setScheduleLoading(false);
    }
  }, [handleCloseSavedSchedule, loadShiftRequests, prepareSchedule, restaurantId, scheduleId]);

  const handleDeleteSavedSchedule = React.useCallback(
    async (id: number) => {
      if (!canManage || !restaurantId) return;
      if (!window.confirm("Удалить этот график? Действие нельзя отменить.")) {
        return;
      }
      setDeletingId(id);
      setScheduleError(null);
      setScheduleMessage(null);
      try {
        await deleteSchedule(restaurantId, id);
        const savedList = await listSavedSchedules(restaurantId);
        setSavedSchedules(savedList);
        if (scheduleId === id) {
          setSchedule(null);
          setSelectedSavedId(null);
          setScheduleReadOnly(false);
          setShiftRequests([]);
        }
        setScheduleMessage("График удалён");
      } catch (e: any) {
        setScheduleError(e?.friendlyMessage || "Не удалось удалить график");
      } finally {
        setDeletingId(null);
      }
    },
    [canManage, restaurantId, scheduleId]
  );

  const handleDeleteSchedule = React.useCallback(() => {
    if (!scheduleId) return;
    void handleDeleteSavedSchedule(scheduleId);
  }, [handleDeleteSavedSchedule, scheduleId]);

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
      const prepared = prepareSchedule(data);
      setSchedule(prepared);
      setScheduleReadOnly(true);
      setLastRange({ start: prepared.config.startDate, end: prepared.config.endDate });
      await loadShiftRequests(scheduleId);
      setScheduleMessage(accepted ? "Заявка одобрена" : "Заявка отклонена");
    } catch (e: any) {
      setScheduleError(e?.friendlyMessage || "Не удалось обработать заявку");
    }
  },
  [loadShiftRequests, prepareSchedule, restaurantId, scheduleId]
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
  const hasSchedule = schedule != null;

  React.useEffect(() => {
    if (!hasSchedule) {
      setActiveTab("table");
      autoTabDoneRef.current = false;
      return;
    }

    if (!scheduleReadOnly) return;
    if (autoTabDoneRef.current) return;

    setActiveTab(hasTodayShifts ? "today" : "table");
    autoTabDoneRef.current = true;
  }, [hasSchedule, scheduleReadOnly, hasTodayShifts]);

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

  const showCreateScheduleButton = canManage && (!schedule || schedule.id != null);

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-zinc-700">
      <BackToHome className="text-sm" />

      {schedule && (
        <button
          type="button"
          onClick={handleCloseSavedSchedule}
          className={
            "inline-flex items-center gap-0 rounded-2xl border border-zinc-200 " +
            "bg-white px-2 py-1 text-sm font-medium text-zinc-700 shadow-sm " +
            "transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          }
          title="Ко всем графикам"
          aria-label="Ко всем графикам"
        >
          <Icon icon={ArrowLeft} size="xs" decorative />
          <span>Ко всем графикам</span>
        </button>
      )}
    </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Графики</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Создавайте и редактируйте графики для выбранных должностей.
          </p>
        </div>
        {showCreateScheduleButton && (
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
        <SavedSchedulesSection
          canManage={canManage}
          savedSchedules={filteredSavedSchedules}
          positions={positions}
          positionFilter={positionFilter}
          onPositionFilterChange={setPositionFilter}
          onOpenSavedSchedule={handleOpenSavedSchedule}
          onEditSavedSchedule={handleEditSavedSchedule}
          onDeleteSavedSchedule={handleDeleteSavedSchedule}
          onDownloadXlsx={handleDownloadXlsx}
          onDownloadJpg={handleDownloadJpg}
          downloadMenuFor={downloadMenuFor}
          onToggleDownloadMenu={setDownloadMenuFor}
          downloading={downloading}
          selectedSavedId={selectedSavedId}
          scheduleLoading={scheduleLoading}
          hasPendingSavedSchedules={hasPendingSavedSchedules}
          deletingId={deletingId}
        />
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
          <ScheduleDetailHeader
            schedule={schedule}
            canManage={canManage}
            scheduleReadOnly={scheduleReadOnly}
            scheduleId={scheduleId}
            deleting={deletingId === scheduleId}
            onEnterEditMode={handleEnterEditMode}
            onDelete={handleDeleteSchedule}
            downloadMenuFor={downloadMenuFor}
            onToggleDownloadMenu={setDownloadMenuFor}
            downloading={downloading}
            onDownloadXlsx={handleDownloadXlsx}
            onDownloadJpg={handleDownloadJpg}
            canCreateShiftRequest={canCreateShiftRequest}
            onOpenReplacement={handleOpenReplacement}
            onOpenSwap={handleOpenSwap}
          />

          <ScheduleTabsNav
            activeTab={activeTab}
            hasTodayShifts={hasTodayShifts}
            onChange={setActiveTab}
          />

          {activeTab === "today" && hasTodayShifts && (
            <TodayShiftsCard todaysShifts={todaysShifts} currentMemberId={currentMember?.id ?? null} />
          )}

          {activeTab === "table" && (
            <ScheduleTableSection
              schedule={schedule}
              scheduleReadOnly={scheduleReadOnly}
              scheduleId={scheduleId}
              saving={saving}
              monthFallback={monthFallback}
              canManage={canManage}
              loading={loading}
              error={error}
              scheduleLoading={scheduleLoading}
              onCancelEdit={handleCancelEdit}
              onSave={handleSaveSchedule}
              onCellChange={handleCellChange}
            />
          )}

          {activeTab === "requests" && (
            <ShiftRequestsSection
              canManage={canManage}
              loading={shiftRequestsLoading}
              error={shiftRequestsError}
              requests={sortedShiftRequests}
              humanStatus={humanStatus}
              shiftDisplay={shiftDisplay}
              canCancelOwnRequest={canCancelOwnRequest}
              onManagerDecision={handleManagerDecision}
              onCancel={handleCancelMyShiftRequest}
            />
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

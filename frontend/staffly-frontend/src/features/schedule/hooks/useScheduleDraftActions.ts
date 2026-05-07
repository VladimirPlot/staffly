import React from "react";

import { createSchedule, listSavedSchedules, updateSchedule, type ScheduleSummary } from "../api";
import type { ScheduleConfig, ScheduleData } from "../types";
import { normalizeCellValue } from "../utils/cellFormatting";
import { daysBetween, formatDayNumber, formatWeekdayShort, monthLabelsBetween } from "../utils/date";
import { buildMemberDisplayNameMap, memberDisplayName } from "../utils/names";
import { hasStartWithoutEndValue } from "../utils/timeValues";
import type { MemberDto } from "../../employees/api";
import type { PositionDto } from "../../dictionaries/api";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

type ScheduleRange = { start: string; end: string } | null;

type UseScheduleDraftActionsParams = {
  restaurantId: number | null;
  canManage: boolean;
  schedule: ScheduleData | null;
  members: MemberDto[];
  positions: PositionDto[];
  prepareSchedule: (schedule: ScheduleData) => ScheduleData;
  loadShiftRequests: (scheduleId?: number | null) => Promise<void>;
  onScheduleChanged: (schedule: ScheduleData | null) => void;
  onScheduleReadOnlyChanged: (value: boolean) => void;
  onSavedSchedulesChanged: (items: ScheduleSummary[]) => void;
  onLastRangeChanged: (value: ScheduleRange) => void;
  onClearScheduleNotices: () => void;
  onScheduleMessage: (message: string) => void;
  onScheduleError: (message: string | null) => void;
  onAutoTabReset: () => void;
};

function buildTitle(positionNames: string[], monthNames: string[]): string {
  const positionsPart = positionNames.join(" - ");
  const monthsPart = monthNames.join("/");
  if (positionsPart && monthsPart) return `${positionsPart} - ${monthsPart}`;
  return positionsPart || monthsPart || "График";
}

function sortMembers(
  members: MemberDto[],
  positionOrder: Map<number, number>,
  displayNames: Record<number, string>,
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

export default function useScheduleDraftActions({
  restaurantId,
  canManage,
  schedule,
  members,
  positions,
  prepareSchedule,
  loadShiftRequests,
  onScheduleChanged,
  onScheduleReadOnlyChanged,
  onSavedSchedulesChanged,
  onLastRangeChanged,
  onClearScheduleNotices,
  onScheduleMessage,
  onScheduleError,
  onAutoTabReset,
}: UseScheduleDraftActionsParams) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!canManage) {
      setDialogOpen(false);
      onScheduleReadOnlyChanged(true);
    }
  }, [canManage, onScheduleReadOnlyChanged]);

  React.useEffect(() => {
    setDialogOpen(false);
    setSaving(false);
  }, [restaurantId]);

  const openDialog = React.useCallback(() => {
    setDialogOpen(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
  }, []);

  const createDraft = React.useCallback(
    (config: ScheduleConfig) => {
      if (!canManage) return;

      onAutoTabReset();

      const normalizedConfig: ScheduleConfig = {
        ...config,
        showFullName: false,
        shiftMode: "FULL",
      };
      const dateList = daysBetween(config.startDate, config.endDate);
      const months = monthLabelsBetween(dateList);
      const selectedPositions = positions.filter((position) => normalizedConfig.positionIds.includes(position.id));
      const positionOrder = new Map<number, number>();
      normalizedConfig.positionIds.forEach((id, index) => {
        positionOrder.set(id, index);
      });

      const filteredMembers = members.filter(
        (member) => member.positionId != null && positionOrder.has(member.positionId),
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
        months,
      );

      onScheduleChanged({
        id: undefined,
        title,
        config: normalizedConfig,
        days,
        rows,
        cellValues: {},
      });
      onScheduleReadOnlyChanged(false);
      onClearScheduleNotices();
      onLastRangeChanged({ start: config.startDate, end: config.endDate });
      setDialogOpen(false);
    },
    [
      canManage,
      members,
      onAutoTabReset,
      onClearScheduleNotices,
      onLastRangeChanged,
      onScheduleChanged,
      onScheduleReadOnlyChanged,
      positions,
    ],
  );

  const saveSchedule = React.useCallback(async () => {
    if (!canManage || !restaurantId || !schedule) return;
    setSaving(true);
    onClearScheduleNotices();
    try {
      if (schedule.config.shiftMode === "FULL") {
        const hasIncompleteShifts = Object.values(schedule.cellValues).some((value) => hasStartWithoutEndValue(value));

        if (hasIncompleteShifts) {
          onScheduleError("Нельзя создать график без времени окончания смены сотрудника");
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
      const prepared = prepareSchedule(saved);
      onScheduleChanged(prepared);
      onScheduleReadOnlyChanged(true);
      onLastRangeChanged({ start: saved.config.startDate, end: saved.config.endDate });
      const savedList = await listSavedSchedules(restaurantId);
      onSavedSchedulesChanged(savedList);
      await loadShiftRequests(saved.id ?? undefined);
      onScheduleMessage(schedule.id ? "График обновлён" : "График сохранён");
    } catch (e: unknown) {
      onScheduleError(getFriendlyScheduleErrorMessage(e, "Не удалось сохранить график"));
    } finally {
      setSaving(false);
    }
  }, [
    canManage,
    loadShiftRequests,
    onClearScheduleNotices,
    onLastRangeChanged,
    onSavedSchedulesChanged,
    onScheduleChanged,
    onScheduleError,
    onScheduleMessage,
    onScheduleReadOnlyChanged,
    prepareSchedule,
    restaurantId,
    schedule,
  ]);

  return React.useMemo(
    () => ({
      dialogOpen,
      saving,
      openDialog,
      closeDialog,
      createDraft,
      saveSchedule,
    }),
    [closeDialog, createDraft, dialogOpen, openDialog, saveSchedule, saving],
  );
}

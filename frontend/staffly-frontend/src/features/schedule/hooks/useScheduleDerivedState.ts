import React from "react";

import type { ScheduleSummary } from "../api";
import type { ScheduleData } from "../types";
import type { MemberDto } from "../../employees/api";
import { monthLabelsBetween } from "../utils/date";

type TodayShift = {
  memberId: number;
  displayName: string;
  shift: string;
};

type UseScheduleDerivedStateParams = {
  userId: number | null | undefined;
  schedule: ScheduleData | null;
  scheduleId: number | null;
  savedSchedules: ScheduleSummary[];
  members: MemberDto[];
  canManage: boolean;
  positionFilter: number | "all";
};

export default function useScheduleDerivedState({
  userId,
  schedule,
  scheduleId,
  savedSchedules,
  members,
  canManage,
  positionFilter,
}: UseScheduleDerivedStateParams) {
  const currentMember = React.useMemo(() => {
    if (!userId) return null;
    return members.find((item) => item.userId === userId) ?? null;
  }, [members, userId]);

  const currentMemberId = currentMember?.id ?? null;

  const scheduleRows = schedule?.rows;
  const scheduleDays = schedule?.days;
  const scheduleCellValues = schedule?.cellValues;

  const currentMemberInSchedule = React.useMemo(() => {
    if (!scheduleRows || currentMemberId == null) return false;
    return scheduleRows.some((row) => row.memberId === currentMemberId);
  }, [currentMemberId, scheduleRows]);

  const hasMyShift = React.useMemo(() => {
    if (!scheduleDays || !scheduleCellValues || currentMemberId == null || !currentMemberInSchedule) return false;
    return scheduleDays.some((day) => {
      const value = scheduleCellValues[`${currentMemberId}:${day.date}`];
      return Boolean(value && value.trim());
    });
  }, [currentMemberId, currentMemberInSchedule, scheduleCellValues, scheduleDays]);

  const monthFallback = React.useMemo(() => {
    if (!scheduleDays) return null;
    const months = monthLabelsBetween(scheduleDays.map((day) => day.date));
    if (months.length > 0) return months.join("/");
    return null;
  }, [scheduleDays]);

  const hasSchedule = schedule != null;

  const canCreateShiftRequest = React.useMemo(
    () => Boolean(hasSchedule && scheduleId && currentMemberId != null && currentMemberInSchedule && hasMyShift),
    [currentMemberId, currentMemberInSchedule, hasMyShift, hasSchedule, scheduleId],
  );

  const hasPendingSavedSchedules = React.useMemo(
    () => savedSchedules.some((item) => item.hasPendingShiftRequests),
    [savedSchedules],
  );

  const shiftDisplay = React.useCallback(
    (memberId: number, day: string | null) => {
      if (!scheduleCellValues || !day) return day ?? "";
      const value = scheduleCellValues[`${memberId}:${day}`];
      if (value) {
        return `${day} (${value})`;
      }
      return day;
    },
    [scheduleCellValues],
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
    if (!scheduleDays || !scheduleRows || !scheduleCellValues) return [] as TodayShift[];
    const hasToday = scheduleDays.some((day) => day.date === todayIso);
    if (!hasToday) return [] as TodayShift[];

    return scheduleRows
      .map((row) => {
        const value = scheduleCellValues[`${row.memberId}:${todayIso}`];
        return {
          memberId: row.memberId,
          displayName: row.displayName,
          shift: value?.trim() ?? "",
        };
      })
      .filter((item) => Boolean(item.shift)) as TodayShift[];
  }, [scheduleCellValues, scheduleDays, scheduleRows, todayIso]);

  const hasTodayShifts = todaysShifts.length > 0;
  const showLandingHeader = !schedule;
  const showCreateScheduleButton = canManage && showLandingHeader;

  return {
    currentMember,
    currentMemberInSchedule,
    hasMyShift,
    canCreateShiftRequest,
    hasPendingSavedSchedules,
    monthFallback,
    shiftDisplay,
    sortedSavedSchedules,
    filteredSavedSchedules,
    todayIso,
    todaysShifts,
    hasTodayShifts,
    hasSchedule,
    showLandingHeader,
    showCreateScheduleButton,
  };
}

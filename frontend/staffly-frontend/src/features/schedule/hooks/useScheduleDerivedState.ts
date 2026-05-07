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

  const currentMemberInSchedule = React.useMemo(() => {
    if (!schedule || currentMemberId == null) return false;
    return schedule.rows.some((row) => row.memberId === currentMemberId);
  }, [currentMemberId, schedule]);

  const hasMyShift = React.useMemo(() => {
    if (!schedule || currentMemberId == null || !currentMemberInSchedule) return false;
    return schedule.days.some((day) => {
      const value = schedule.cellValues[`${currentMemberId}:${day.date}`];
      return Boolean(value && value.trim());
    });
  }, [currentMemberId, currentMemberInSchedule, schedule]);

  const monthFallback = React.useMemo(() => {
    if (!schedule) return null;
    const months = monthLabelsBetween(schedule.days.map((day) => day.date));
    if (months.length > 0) return months.join("/");
    return null;
  }, [schedule]);

  const canCreateShiftRequest = React.useMemo(
    () => Boolean(schedule && scheduleId && currentMemberId != null && currentMemberInSchedule && hasMyShift),
    [currentMemberId, currentMemberInSchedule, hasMyShift, schedule, scheduleId],
  );

  const hasPendingSavedSchedules = React.useMemo(
    () => savedSchedules.some((item) => item.hasPendingShiftRequests),
    [savedSchedules],
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
    [schedule],
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
    if (!schedule) return [] as TodayShift[];
    const hasToday = schedule.days.some((day) => day.date === todayIso);
    if (!hasToday) return [] as TodayShift[];

    return schedule.rows
      .map((row) => {
        const value = schedule.cellValues[`${row.memberId}:${todayIso}`];
        return {
          memberId: row.memberId,
          displayName: row.displayName,
          shift: value?.trim() ?? "",
        };
      })
      .filter((item) => Boolean(item.shift)) as TodayShift[];
  }, [schedule, todayIso]);

  const hasTodayShifts = todaysShifts.length > 0;
  const hasSchedule = schedule != null;
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

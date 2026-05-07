import React from "react";

import { changeScheduleOwner, getScheduleOwnerCandidates } from "../api";
import type { ScheduleData, ScheduleOwnerDto } from "../types";

type UseScheduleOwnerDialogParams = {
  restaurantId: number | null;
  canManage: boolean;
  schedule: ScheduleData | null;
  scheduleId: number | null;
  prepareSchedule: (schedule: ScheduleData) => ScheduleData;
  onScheduleUpdated: (schedule: ScheduleData) => void;
  onSavedScheduleOwnerUpdated: (scheduleId: number, owner: ScheduleOwnerDto | null) => void;
  onSuccessMessage: (message: string) => void;
  onClearScheduleError: () => void;
};

export default function useScheduleOwnerDialog({
  restaurantId,
  canManage,
  schedule,
  scheduleId,
  prepareSchedule,
  onScheduleUpdated,
  onSavedScheduleOwnerUpdated,
  onSuccessMessage,
  onClearScheduleError,
}: UseScheduleOwnerDialogParams) {
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<ScheduleOwnerDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedOwnerUserId, setSelectedOwnerUserId] = React.useState<number | null>(null);

  const currentOwnerUserId = schedule?.owner?.userId ?? null;

  const reset = React.useCallback(() => {
    setOpen(false);
    setCandidates([]);
    setLoading(false);
    setSaving(false);
    setError(null);
    setSelectedOwnerUserId(null);
  }, []);

  React.useEffect(() => {
    reset();
  }, [restaurantId, reset]);

  const closeDialog = React.useCallback(() => {
    if (saving) return;
    setOpen(false);
    setCandidates([]);
    setLoading(false);
    setError(null);
    setSelectedOwnerUserId(null);
  }, [saving]);

  const openDialog = React.useCallback(async () => {
    if (!canManage || !restaurantId || !scheduleId) return;

    setOpen(true);
    setCandidates([]);
    setError(null);
    setSelectedOwnerUserId(null);
    setLoading(true);
    try {
      const nextCandidates = await getScheduleOwnerCandidates(restaurantId, scheduleId);
      setCandidates(nextCandidates);
      const firstAvailable = nextCandidates.find(
        (candidate) => candidate.userId != null && candidate.userId !== currentOwnerUserId
      );
      setSelectedOwnerUserId(firstAvailable?.userId ?? null);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Не удалось загрузить кандидатов для смены ответственного");
    } finally {
      setLoading(false);
    }
  }, [canManage, currentOwnerUserId, restaurantId, scheduleId]);

  const submit = React.useCallback(async () => {
    if (!canManage || !restaurantId || !scheduleId || selectedOwnerUserId == null) return;
    if (selectedOwnerUserId === currentOwnerUserId) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await changeScheduleOwner(restaurantId, scheduleId, selectedOwnerUserId);
      const prepared = prepareSchedule(updated);
      onScheduleUpdated(prepared);
      onSavedScheduleOwnerUpdated(scheduleId, prepared.owner ?? null);
      onSuccessMessage("Ответственный изменён");
      onClearScheduleError();
      setOpen(false);
      setCandidates([]);
      setSelectedOwnerUserId(null);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Не удалось сменить ответственного");
    } finally {
      setSaving(false);
    }
  }, [
    canManage,
    currentOwnerUserId,
    onClearScheduleError,
    onSavedScheduleOwnerUpdated,
    onScheduleUpdated,
    onSuccessMessage,
    prepareSchedule,
    restaurantId,
    scheduleId,
    selectedOwnerUserId,
  ]);

  return {
    open,
    loading,
    saving,
    error,
    candidates,
    selectedOwnerUserId,
    currentOwnerUserId,
    setSelectedOwnerUserId,
    openDialog,
    closeDialog,
    submit,
  };
}

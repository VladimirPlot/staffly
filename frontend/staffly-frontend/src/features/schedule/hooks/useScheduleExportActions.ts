import React from "react";

import { fetchSchedule } from "../api";
import type { ScheduleData } from "../types";
import { exportScheduleToJpeg, exportScheduleToXlsx } from "../utils/exporters";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

type DownloadingSchedule = { id: number; type: "xlsx" | "jpg" } | null;

type UseScheduleExportActionsParams = {
  restaurantId: number | null;
  currentSchedule: ScheduleData | null;
  onError: (message: string) => void;
};

export default function useScheduleExportActions({
  restaurantId,
  currentSchedule,
  onError,
}: UseScheduleExportActionsParams) {
  const [downloading, setDownloading] = React.useState<DownloadingSchedule>(null);

  const fetchScheduleForActions = React.useCallback(
    async (id: number) => {
      if (!restaurantId) {
        throw new Error("Не выбран ресторан");
      }
      if (currentSchedule && currentSchedule.id === id) {
        return currentSchedule;
      }
      return await fetchSchedule(restaurantId, id);
    },
    [currentSchedule, restaurantId],
  );

  const downloadXlsx = React.useCallback(
    async (id: number) => {
      if (!restaurantId) {
        return;
      }
      setDownloading({ id, type: "xlsx" });
      try {
        const data = await fetchScheduleForActions(id);
        exportScheduleToXlsx(data);
      } catch (e: unknown) {
        console.error(e);
        onError(getFriendlyScheduleErrorMessage(e, "Не удалось скачать график"));
      } finally {
        setDownloading((prev) => (prev && prev.id === id ? null : prev));
      }
    },
    [fetchScheduleForActions, onError, restaurantId],
  );

  const downloadJpg = React.useCallback(
    async (id: number) => {
      if (!restaurantId) {
        return;
      }
      setDownloading({ id, type: "jpg" });
      try {
        const data = await fetchScheduleForActions(id);
        await exportScheduleToJpeg(data);
      } catch (e: unknown) {
        console.error(e);
        onError(getFriendlyScheduleErrorMessage(e, "Не удалось скачать график"));
      } finally {
        setDownloading((prev) => (prev && prev.id === id ? null : prev));
      }
    },
    [fetchScheduleForActions, onError, restaurantId],
  );

  return {
    downloading,
    downloadXlsx,
    downloadJpg,
  };
}

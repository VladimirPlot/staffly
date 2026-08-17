import { useCallback, useState } from "react";

import {
  getChecklistHistory,
  listChecklistHistory,
  type ChecklistDto,
  type ChecklistHistoryDetailDto,
  type ChecklistHistorySummaryDto,
} from "../api";

export function useChecklistHistory(restaurantId: number) {
  const [historyTarget, setHistoryTarget] = useState<ChecklistDto | null>(null);
  const [historySummaries, setHistorySummaries] = useState<ChecklistHistorySummaryDto[]>([]);
  const [historyDetail, setHistoryDetail] = useState<ChecklistHistoryDetailDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDetailLoading, setHistoryDetailLoading] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistoryDetail = useCallback(
    async (historyId: number) => {
      setHistoryDetailLoading(historyId);
      setHistoryError(null);
      try {
        const detail = await getChecklistHistory(restaurantId, historyId);
        setHistoryDetail(detail);
      } catch (e: any) {
        console.error("Failed to load checklist history detail", e);
        setHistoryError(e?.friendlyMessage || "Не удалось загрузить историю");
      } finally {
        setHistoryDetailLoading(null);
      }
    },
    [restaurantId],
  );

  const openHistoryModal = useCallback(
    async (checklist: ChecklistDto) => {
      setHistoryTarget(checklist);
      setHistorySummaries([]);
      setHistoryDetail(null);
      setHistoryError(null);
      setHistoryLoading(true);
      try {
        const summaries = await listChecklistHistory(restaurantId, checklist.id);
        setHistorySummaries(summaries);
        if (summaries[0]) {
          await loadHistoryDetail(summaries[0].id);
        }
      } catch (e: any) {
        console.error("Failed to load checklist history", e);
        setHistoryError(e?.friendlyMessage || "Не удалось загрузить историю");
      } finally {
        setHistoryLoading(false);
      }
    },
    [loadHistoryDetail, restaurantId],
  );

  const closeHistoryModal = useCallback(() => {
    if (historyLoading || historyDetailLoading !== null) return;
    setHistoryTarget(null);
    setHistorySummaries([]);
    setHistoryDetail(null);
    setHistoryError(null);
  }, [historyDetailLoading, historyLoading]);

  return {
    historyTarget,
    historySummaries,
    historyDetail,
    historyLoading,
    historyDetailLoading,
    historyError,
    loadHistoryDetail,
    openHistoryModal,
    closeHistoryModal,
  };
}

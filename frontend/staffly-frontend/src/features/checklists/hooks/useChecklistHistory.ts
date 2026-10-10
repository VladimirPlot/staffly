import { useCallback, useEffect, useRef, useState } from "react";
import {
  getChecklistHistory,
  listChecklistHistory,
  listRestaurantChecklistHistory,
  type ChecklistDto,
  type ChecklistHistoryDetailDto,
  type ChecklistHistorySummaryDto,
} from "../api";
type HistoryTarget = { id?: number; name: string };
export function useChecklistHistory(restaurantId: number) {
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null);
  const [historySummaries, setHistorySummaries] = useState<ChecklistHistorySummaryDto[]>([]);
  const [historyDetail, setHistoryDetail] = useState<ChecklistHistoryDetailDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDetailLoading, setHistoryDetailLoading] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const targetRef = useRef<HistoryTarget | null>(null);
  const session = useRef(0);
  const detailLoadingRef = useRef(false);
  const detailRequest = useRef(0);
  const pageRef = useRef(0);
  const pageLoading = useRef(false);
  const loadHistoryDetail = useCallback(
    async (historyId: number, background = false) => {
      if (background && detailLoadingRef.current) return;
      if (!background) detailLoadingRef.current = true;
      const request = ++detailRequest.current;
      const currentSession = session.current;
      if (!background) {
        setHistoryDetailLoading(historyId);
        setHistoryError(null);
      }
      try {
        const detail = await getChecklistHistory(restaurantId, historyId);
        if (request === detailRequest.current && currentSession === session.current) setHistoryDetail(detail);
      } catch (e: any) {
        if (!background && request === detailRequest.current && currentSession === session.current)
          setHistoryError(e?.friendlyMessage || "Не удалось загрузить историю");
      } finally {
        if (!background && request === detailRequest.current && currentSession === session.current) {
          detailLoadingRef.current = false;
          setHistoryDetailLoading(null);
        }
      }
    },
    [restaurantId],
  );
  const loadPage = useCallback(
    async (target: HistoryTarget, page: number, currentSession: number) => {
      if (pageLoading.current) return;
      pageLoading.current = true;
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const summaries =
          target.id != null
            ? await listChecklistHistory(restaurantId, target.id, page)
            : await listRestaurantChecklistHistory(restaurantId, page);
        if (currentSession !== session.current) return;
        setHistorySummaries((prev) =>
          page === 0
            ? summaries
            : [...prev, ...summaries.filter((entry) => !prev.some((existing) => existing.id === entry.id))],
        );
        pageRef.current = page;
        setHasMoreHistory(summaries.length === 50);
        if (page === 0 && summaries[0]) await loadHistoryDetail(summaries[0].id);
      } catch (e: any) {
        if (currentSession === session.current) setHistoryError(e?.friendlyMessage || "Не удалось загрузить историю");
      } finally {
        if (currentSession === session.current) {
          pageLoading.current = false;
          setHistoryLoading(false);
        }
      }
    },
    [loadHistoryDetail, restaurantId],
  );
  const openTarget = useCallback(
    (target: HistoryTarget) => {
      session.current++;
      detailRequest.current++;
      pageLoading.current = false;
      detailLoadingRef.current = false;
      targetRef.current = target;
      setHistoryTarget(target);
      setHistorySummaries([]);
      setHistoryDetail(null);
      setHistoryDetailLoading(null);
      setHasMoreHistory(false);
      void loadPage(target, 0, session.current);
    },
    [loadPage],
  );
  const openHistoryModal = useCallback((checklist: ChecklistDto) => openTarget(checklist), [openTarget]);
  const openArchiveModal = useCallback(() => openTarget({ name: "Архив чек-листов" }), [openTarget]);
  const loadMoreHistory = useCallback(() => {
    if (targetRef.current) void loadPage(targetRef.current, pageRef.current + 1, session.current);
  }, [loadPage]);
  const closeHistoryModal = useCallback(() => {
    session.current++;
    detailRequest.current++;
    pageLoading.current = false;
    detailLoadingRef.current = false;
    targetRef.current = null;
    setHistoryTarget(null);
    setHistorySummaries([]);
    setHistoryDetail(null);
    setHistoryLoading(false);
    setHistoryDetailLoading(null);
    setHistoryError(null);
  }, []);
  const selectedHistoryId = historyDetail?.id;
  useEffect(() => {
    if (!historyTarget || selectedHistoryId == null || historyDetailLoading != null) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadHistoryDetail(selectedHistoryId, true);
    };
    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [historyTarget, selectedHistoryId, historyDetailLoading, loadHistoryDetail]);
  useEffect(() => {
    closeHistoryModal();
    return closeHistoryModal;
  }, [restaurantId, closeHistoryModal]);
  return {
    historyTarget,
    historySummaries,
    historyDetail,
    historyLoading,
    historyDetailLoading,
    historyError,
    hasMoreHistory,
    loadMoreHistory,
    loadHistoryDetail,
    openHistoryModal,
    openArchiveModal,
    closeHistoryModal,
  };
}

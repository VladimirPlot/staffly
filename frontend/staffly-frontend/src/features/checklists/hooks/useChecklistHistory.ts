import { useCallback, useEffect, useRef, useState } from "react";
import {
  getChecklistHistory,
  listChecklistHistory,
  listChecklistArchive,
  listLegacyChecklistHistory,
  type ChecklistArchiveEntryDto,
  type ChecklistDto,
  type ChecklistHistoryDetailDto,
  type ChecklistHistorySummaryDto,
} from "../api";
type HistoryTarget = { id?: number; name: string; legacyHistoryId?: number };
export function useChecklistHistory(restaurantId: number) {
  const [archiveEntries, setArchiveEntries] = useState<ChecklistArchiveEntryDto[]>([]);
  const [archiveNavigation, setArchiveNavigation] = useState(false);
  const selectedDetailId = useRef<number | null>(null);
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
      if (background && (detailLoadingRef.current || selectedDetailId.current !== historyId)) return;
      if (!background) detailLoadingRef.current = true;
      const request = ++detailRequest.current;
      const currentSession = session.current;
      if (!background) {
        selectedDetailId.current = historyId;
        setHistoryDetail(null);
        setHistoryDetailLoading(historyId);
        setHistoryError(null);
      }
      try {
        const detail = await getChecklistHistory(restaurantId, historyId);
        if (
          request === detailRequest.current &&
          currentSession === session.current &&
          selectedDetailId.current === historyId
        )
          setHistoryDetail(detail);
      } catch (e: any) {
        if (!background && request === detailRequest.current && currentSession === session.current) {
          selectedDetailId.current = null;
          setHistoryError(e?.friendlyMessage || "Не удалось загрузить историю");
        }
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
            : await listLegacyChecklistHistory(restaurantId, target.legacyHistoryId!, page);
        if (currentSession !== session.current) return;
        setHistorySummaries((prev) =>
          page === 0
            ? summaries
            : [...prev, ...summaries.filter((entry) => !prev.some((existing) => existing.id === entry.id))],
        );
        pageRef.current = page;
        setHasMoreHistory(summaries.length === 50);
      } catch (e: any) {
        if (currentSession === session.current) setHistoryError(e?.friendlyMessage || "Не удалось загрузить историю");
      } finally {
        if (currentSession === session.current) {
          pageLoading.current = false;
          setHistoryLoading(false);
        }
      }
    },
    [restaurantId],
  );
  const openTarget = useCallback(
    (target: HistoryTarget) => {
      session.current++;
      detailRequest.current++;
      pageLoading.current = false;
      detailLoadingRef.current = false;
      selectedDetailId.current = null;
      targetRef.current = target;
      setHistoryTarget(target);
      setHistorySummaries([]);
      setHistoryDetail(null);
      setHistoryDetailLoading(null);
      setHasMoreHistory(false);
      setHistoryError(null);
      if (target.id != null || target.legacyHistoryId != null) {
        void loadPage(target, 0, session.current);
      } else {
        const currentSession = session.current;
        setArchiveEntries([]);
        setHistoryLoading(true);
        void listChecklistArchive(restaurantId)
          .then((entries) => {
            if (currentSession === session.current) setArchiveEntries(entries);
          })
          .catch((e: any) => {
            if (currentSession === session.current) setHistoryError(e?.friendlyMessage || "Не удалось загрузить архив");
          })
          .finally(() => {
            if (currentSession === session.current) setHistoryLoading(false);
          });
      }
    },
    [loadPage, restaurantId],
  );
  const openHistoryModal = useCallback(
    (checklist: ChecklistDto) => {
      setArchiveNavigation(false);
      openTarget(checklist);
    },
    [openTarget],
  );
  const openArchiveModal = useCallback(() => {
    setArchiveNavigation(true);
    openTarget({ name: "Архив чек-листов" });
  }, [openTarget]);
  const selectArchiveEntry = useCallback(
    (entry: ChecklistArchiveEntryDto) =>
      openTarget({
        id: entry.checklistId ?? undefined,
        name: entry.name,
        legacyHistoryId: entry.legacyHistoryId ?? undefined,
      }),
    [openTarget],
  );
  const toggleHistoryDetail = useCallback(
    (historyId: number) => {
      if (selectedDetailId.current === historyId) {
        selectedDetailId.current = null;
        detailRequest.current++;
        detailLoadingRef.current = false;
        setHistoryDetail(null);
        setHistoryDetailLoading(null);
        setHistoryError(null);
      } else {
        void loadHistoryDetail(historyId);
      }
    },
    [loadHistoryDetail],
  );
  const loadMoreHistory = useCallback(() => {
    if (targetRef.current) void loadPage(targetRef.current, pageRef.current + 1, session.current);
  }, [loadPage]);
  const closeHistoryModal = useCallback(() => {
    session.current++;
    detailRequest.current++;
    pageLoading.current = false;
    detailLoadingRef.current = false;
    selectedDetailId.current = null;
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
    archiveEntries,
    archiveNavigation,
    selectArchiveEntry,
    toggleHistoryDetail,
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

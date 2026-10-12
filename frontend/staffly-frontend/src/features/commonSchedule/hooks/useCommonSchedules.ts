import React from "react";
import { getErrorMessage } from "../../../shared/utils/errors";
import {
  deleteCommonSchedule,
  getCommonSchedule,
  listCommonSchedules,
  saveCommonSchedule,
  type CommonSchedule,
  type CommonSchedulePayload,
  type CommonScheduleSummary,
} from "../api";

type Params = {
  restaurantId: number;
  onViewingChange: (viewing: boolean) => void;
  onRefreshSources: () => Promise<void>;
};

export default function useCommonSchedules({ restaurantId, onViewingChange, onRefreshSources }: Params) {
  const [items, setItems] = React.useState<CommonScheduleSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<CommonSchedule | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const [dialog, setDialog] = React.useState<{ initial: CommonScheduleSummary | null } | null>(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<CommonScheduleSummary | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    onViewingChange(selectedId != null);
    return () => onViewingChange(false);
  }, [selectedId, onViewingChange]);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    listCommonSchedules(restaurantId, controller.signal)
      .then(setItems)
      .catch((e) => {
        if (!controller.signal.aborted) setError(getErrorMessage(e, "Не удалось загрузить общие графики"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [restaurantId, revision]);

  React.useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      // Focus and polling can overlap. Only the latest response is allowed to render.
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setRefreshing(true);
      try {
        const result = await getCommonSchedule(restaurantId, selectedId, request.signal);
        if (!request.signal.aborted) {
          setDetail(result);
          setError(null);
        }
      } catch (e) {
        if (!request.signal.aborted) {
          setDetail(null);
          setError(getErrorMessage(e, "Не удалось обновить общий график"));
        }
      } finally {
        if (!request.signal.aborted) setRefreshing(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [restaurantId, selectedId, revision]);

  const edit = (initial: CommonScheduleSummary | null) => {
    setDialogError(null);
    setDialog({ initial });
    void onRefreshSources().catch((e) =>
      setDialogError(getErrorMessage(e, "Не удалось обновить список исходных графиков")),
    );
  };

  const save = async (payload: CommonSchedulePayload) => {
    if (saving) return;
    setSaving(true);
    setDialogError(null);
    try {
      const result = await saveCommonSchedule(restaurantId, payload, dialog?.initial?.id);
      setDialog(null);
      setError(null);
      setDetail(result);
      setSelectedId(result.summary.id);
      setRevision((v) => v + 1);
    } catch (e) {
      setDialogError(getErrorMessage(e, "Не удалось сохранить общий график"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteCommonSchedule(restaurantId, deleteTarget);
      setDeleteTarget(null);
      setError(null);
      setRevision((v) => v + 1);
    } catch (e) {
      setDeleteTarget(null);
      setError(getErrorMessage(e, "Не удалось удалить общий график"));
    } finally {
      setDeleting(false);
    }
  };

  return {
    items,
    loading,
    error,
    selectedId,
    detail,
    refreshing,
    dialog,
    dialogError,
    saving,
    deleteTarget,
    deleting,
    refresh: () => {
      setError(null);
      setRevision((v) => v + 1);
    },
    back: () => {
      setSelectedId(null);
      setError(null);
      setRevision((v) => v + 1);
    },
    open: (id: number) => {
      setDetail(null);
      setError(null);
      setSelectedId(id);
    },
    closeDialog: () => {
      if (!saving) setDialog(null);
    },
    requestDelete: setDeleteTarget,
    cancelDelete: () => {
      if (!deleting) setDeleteTarget(null);
    },
    edit,
    save,
    remove,
  };
}

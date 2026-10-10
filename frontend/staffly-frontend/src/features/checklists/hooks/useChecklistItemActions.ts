import { useCallback, useEffect, useRef, useState } from "react";

import { compressImageFile } from "../../../shared/lib/compressImageFile";
import {
  deleteChecklistItemCompletionPhoto,
  resetChecklist,
  uploadChecklistItemCompletionPhoto,
  type ChecklistDto,
  type ChecklistItemDto,
} from "../api";

type UseChecklistItemActionsParams = {
  restaurantId: number;
  updateChecklistInState: (updated: ChecklistDto) => void;
  reloadChecklists: () => Promise<void>;
};

export function useChecklistItemActions({
  restaurantId,
  updateChecklistInState,
  reloadChecklists,
}: UseChecklistItemActionsParams) {
  const [itemActionLoading, setItemActionLoading] = useState<Set<string>>(new Set());
  const [itemActionError, setItemActionError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<number | null>(null);
  const [photoUploading, setPhotoUploading] = useState<Set<string>>(new Set());
  const checklistLocks = useRef(new Set<number>());
  const errorTimeoutRef = useRef<number | null>(null);

  const reportItemActionError = useCallback((message: string | null) => {
    setItemActionError(message);
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    if (message) {
      errorTimeoutRef.current = window.setTimeout(() => {
        setItemActionError(null);
        errorTimeoutRef.current = null;
      }, 3000);
    }
  }, []);

  const toggleItemAction = useCallback((key: string, loading: boolean) => {
    setItemActionLoading((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const handleItemAction = useCallback(
    async (key: string, action: () => Promise<ChecklistDto>) => {
      const checklistId = Number(key.split("-")[0]);
      if (checklistLocks.current.has(checklistId)) return;
      checklistLocks.current.add(checklistId);
      reportItemActionError(null);
      toggleItemAction(key, true);
      try {
        const updated = await action();
        updateChecklistInState(updated);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 409 || status === 403) {
          reportItemActionError(e?.friendlyMessage || "Чек-лист изменился. Данные обновлены, повторите действие");
          await reloadChecklists();
        } else {
          console.error("Failed to update checklist item", e);
          reportItemActionError(e?.friendlyMessage || "Не удалось обновить пункт");
        }
      } finally {
        checklistLocks.current.delete(checklistId);
        toggleItemAction(key, false);
      }
    },
    [reportItemActionError, toggleItemAction, updateChecklistInState, reloadChecklists],
  );

  const togglePhotoUploading = useCallback((key: string, loading: boolean) => {
    setPhotoUploading((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const handleCompletionPhotoUpload = useCallback(
    async (checklist: ChecklistDto, item: ChecklistItemDto, file: File) => {
      const key = `${checklist.id}-${item.id}-completion-photo`;
      if (checklistLocks.current.has(checklist.id)) return;
      checklistLocks.current.add(checklist.id);
      reportItemActionError(null);
      togglePhotoUploading(key, true);
      try {
        const compressed = await compressImageFile(file);
        const updated = await uploadChecklistItemCompletionPhoto(
          restaurantId,
          checklist.id,
          item.id,
          compressed,
          checklist.version,
        );
        updateChecklistInState(updated);
      } catch (e: any) {
        console.error("Failed to upload checklist item photo", e);
        reportItemActionError(e?.friendlyMessage || "Не удалось загрузить фото");
        if (e?.response?.status === 409) await reloadChecklists();
      } finally {
        checklistLocks.current.delete(checklist.id);
        togglePhotoUploading(key, false);
      }
    },
    [reportItemActionError, restaurantId, togglePhotoUploading, updateChecklistInState, reloadChecklists],
  );

  const handleCompletionPhotoDelete = useCallback(
    async (checklist: ChecklistDto, item: ChecklistItemDto) => {
      const key = `${checklist.id}-${item.id}-completion-photo`;
      if (checklistLocks.current.has(checklist.id)) return;
      checklistLocks.current.add(checklist.id);
      reportItemActionError(null);
      togglePhotoUploading(key, true);
      try {
        const updated = await deleteChecklistItemCompletionPhoto(
          restaurantId,
          checklist.id,
          item.id,
          checklist.version,
        );
        updateChecklistInState(updated);
      } catch (e: any) {
        console.error("Failed to delete checklist item photo", e);
        reportItemActionError(e?.friendlyMessage || "Не удалось удалить фото");
        if (e?.response?.status === 409) await reloadChecklists();
      } finally {
        checklistLocks.current.delete(checklist.id);
        togglePhotoUploading(key, false);
      }
    },
    [reportItemActionError, restaurantId, togglePhotoUploading, updateChecklistInState, reloadChecklists],
  );

  const handleReset = useCallback(
    async (checklist: ChecklistDto) => {
      if (checklistLocks.current.has(checklist.id)) return;
      checklistLocks.current.add(checklist.id);
      setResetting(checklist.id);
      try {
        await resetChecklist(restaurantId, checklist.id, checklist.version);
        await reloadChecklists();
      } catch (e: any) {
        reportItemActionError(e?.friendlyMessage || "Не удалось сбросить чек-лист");
        await reloadChecklists();
      } finally {
        checklistLocks.current.delete(checklist.id);
        setResetting(null);
      }
    },
    [restaurantId, reloadChecklists, reportItemActionError],
  );

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  return {
    itemActionLoading,
    itemActionError,
    resetting,
    photoUploading,
    handleItemAction,
    handleCompletionPhotoUpload,
    handleCompletionPhotoDelete,
    handleReset,
  };
}

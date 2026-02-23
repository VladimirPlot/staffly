import { useCallback, useEffect, useState } from "react";
import { mapFoldersForUi } from "../api/mappers";
import { hideFolder, listFolders, restoreFolder } from "../api/trainingApi";
import type { TrainingFolderDto, TrainingFolderType } from "../api/types";
import { getTrainingErrorMessage } from "../utils/errors";

type Params = {
  restaurantId: number | null;
  type: TrainingFolderType;
  canManage: boolean;
};

export function useTrainingFolders({ restaurantId, type, canManage }: Params) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [folders, setFolders] = useState<TrainingFolderDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await listFolders(restaurantId, type, canManage ? includeInactive : false);
      setFolders(mapFoldersForUi(response));
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось загрузить папки."));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, type, canManage, includeInactive]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAction = useCallback(
    async (folderId: number, action: "hide" | "restore") => {
      if (!restaurantId) return;
      setActionLoadingId(folderId);
      setError(null);
      try {
        if (action === "hide") {
          await hideFolder(restaurantId, folderId);
        } else {
          await restoreFolder(restaurantId, folderId);
        }
        await reload();
      } catch (e) {
        setError(getTrainingErrorMessage(e, "Не удалось выполнить действие с папкой."));
      } finally {
        setActionLoadingId(null);
      }
    },
    [restaurantId, reload]
  );

  return {
    folders,
    loading,
    error,
    includeInactive,
    setIncludeInactive,
    actionLoadingId,
    reload,
    hide: (folderId: number) => runAction(folderId, "hide"),
    restore: (folderId: number) => runAction(folderId, "restore"),
  };
}

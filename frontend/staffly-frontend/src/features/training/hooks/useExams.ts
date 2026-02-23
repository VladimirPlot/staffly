import { useCallback, useEffect, useState } from "react";
import { mapExamsForUi } from "../api/mappers";
import { deleteExam, hideExam, listExams, resetExamResults, restoreExam } from "../api/trainingApi";
import type { TrainingExamDto } from "../api/types";
import { getTrainingErrorMessage } from "../utils/errors";

type Params = {
  restaurantId: number | null;
  canManage: boolean;
};

export function useExams({ restaurantId, canManage }: Params) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [exams, setExams] = useState<TrainingExamDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await listExams(restaurantId, canManage ? includeInactive : false);
      setExams(mapExamsForUi(response));
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось загрузить аттестации."));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canManage, includeInactive]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAction = useCallback(
    async (examId: number, action: "hide" | "restore" | "delete" | "reset") => {
      if (!restaurantId) return;
      setActionLoadingId(examId);
      setError(null);

      try {
        if (action === "hide") await hideExam(restaurantId, examId);
        if (action === "restore") await restoreExam(restaurantId, examId);
        if (action === "delete") await deleteExam(restaurantId, examId);
        if (action === "reset") await resetExamResults(restaurantId, examId);
        await reload();
      } catch (e) {
        setError(getTrainingErrorMessage(e, "Не удалось выполнить действие с аттестацией."));
      } finally {
        setActionLoadingId(null);
      }
    },
    [restaurantId, reload]
  );

  return {
    exams,
    loading,
    error,
    includeInactive,
    setIncludeInactive,
    actionLoadingId,
    reload,
    hide: (examId: number) => runAction(examId, "hide"),
    restore: (examId: number) => runAction(examId, "restore"),
    remove: (examId: number) => runAction(examId, "delete"),
    resetResults: (examId: number) => runAction(examId, "reset"),
  };
}

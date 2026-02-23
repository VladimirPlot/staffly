import { useCallback, useEffect, useState } from "react";
import { listExams, listFolders } from "../api/trainingApi";
import { getTrainingErrorMessage } from "../utils/errors";

type Params = {
  restaurantId: number | null;
  canManage: boolean;
};

type TrainingLandingData = {
  knowledgeFoldersCount: number;
  questionFoldersCount: number;
  examsCount: number;
};

const INITIAL: TrainingLandingData = {
  knowledgeFoldersCount: 0,
  questionFoldersCount: 0,
  examsCount: 0,
};

export function useTrainingLandingData({ restaurantId, canManage }: Params) {
  const [data, setData] = useState<TrainingLandingData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!restaurantId) return;

    setLoading(true);
    setError(null);
    try {
      const requests: Promise<unknown>[] = [
        listFolders(restaurantId, "KNOWLEDGE", false),
        listExams(restaurantId, false),
      ];
      if (canManage) {
        requests.push(listFolders(restaurantId, "QUESTION_BANK", false));
      }

      const [knowledge, exams, questionFolders] = await Promise.all(requests);
      setData({
        knowledgeFoldersCount: Array.isArray(knowledge) ? knowledge.length : 0,
        examsCount: Array.isArray(exams) ? exams.length : 0,
        questionFoldersCount: Array.isArray(questionFolders) ? questionFolders.length : 0,
      });
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось загрузить данные модуля обучения."));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canManage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...data, loading, error, reload };
}

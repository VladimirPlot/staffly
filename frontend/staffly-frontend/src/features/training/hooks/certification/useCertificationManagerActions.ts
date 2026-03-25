import { useCallback, useState } from "react";
import {
  grantCertificationEmployeeExtraAttempt,
  resetCertificationEmployeeAttempts,
  resetCertificationExamResults,
} from "../../api/trainingApi";
import { getTrainingErrorMessage } from "../../utils/errors";

export function useCertificationManagerActions(restaurantId: number | null, examId: number | null, onDone: () => Promise<void>) {
  const [loadingActionKey, setLoadingActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (key: string, action: () => Promise<void>) => {
    setLoadingActionKey(key);
    setError(null);
    try {
      await action();
      await onDone();
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось выполнить действие менеджера."));
    } finally {
      setLoadingActionKey(null);
    }
  }, [onDone]);

  const resetExam = useCallback(async () => {
    if (!restaurantId || !examId) return;
    await run("reset:exam", () => resetCertificationExamResults(restaurantId, examId));
  }, [restaurantId, examId, run]);

  const resetEmployee = useCallback(async (userId: number) => {
    if (!restaurantId || !examId) return;
    await run(`reset:${userId}`, () => resetCertificationEmployeeAttempts(restaurantId, examId, userId));
  }, [restaurantId, examId, run]);

  const grantEmployeeAttempt = useCallback(async (userId: number, amount = 1) => {
    if (!restaurantId || !examId) return;
    await run(`grant:${userId}`, () => grantCertificationEmployeeExtraAttempt(restaurantId, examId, userId, amount));
  }, [restaurantId, examId, run]);

  return { loadingActionKey, error, resetExam, resetEmployee, grantEmployeeAttempt };
}

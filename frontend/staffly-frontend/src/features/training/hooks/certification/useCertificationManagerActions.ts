import { useCallback, useState } from "react";
import {
  grantCertificationEmployeeExtraAttempt,
  resetCertificationEmployeeAttempts,
  resetCertificationExamCycle,
} from "../../api/trainingApi";
import { getTrainingErrorMessage } from "../../utils/errors";
import type { CertificationManagerActionsState } from "./types";

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

  const resetExamCycle = useCallback(async () => {
    if (!restaurantId || !examId) return;
    await run("reset:exam", () => resetCertificationExamCycle(restaurantId, examId));
  }, [restaurantId, examId, run]);

  const resetEmployee = useCallback(async (userId: number) => {
    if (!restaurantId || !examId) return;
    await run(`reset:${userId}`, () => resetCertificationEmployeeAttempts(restaurantId, examId, userId));
  }, [restaurantId, examId, run]);

  const grantEmployeeAttempt = useCallback(async (userId: number, amount = 1) => {
    if (!restaurantId || !examId) return;
    await run(`grant:${userId}`, () => grantCertificationEmployeeExtraAttempt(restaurantId, examId, userId, amount));
  }, [restaurantId, examId, run]);

  const actions: CertificationManagerActionsState = {
    loadingActionKey,
    error,
    resetExamCycle,
    resetEmployee,
    grantEmployeeAttempt,
  };

  return actions;
}

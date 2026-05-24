import { useCallback, useEffect, useRef, useState } from "react";
import { getCertificationEmployeeAttempts } from "../../api/trainingApi";
import type { CertificationExamAttemptHistoryDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";

export function useCertificationEmployeeAttempts(
  restaurantId: number | null,
  examId: number | null,
  selectedEmployeeUserId: number | null,
) {
  const [attempts, setAttempts] = useState<CertificationExamAttemptHistoryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!restaurantId || !examId || !selectedEmployeeUserId) {
      requestIdRef.current += 1;
      setAttempts([]);
      setError(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setAttempts([]);
    setLoading(true);
    setError(null);
    try {
      const nextAttempts = await getCertificationEmployeeAttempts(restaurantId, examId, selectedEmployeeUserId);
      if (requestId !== requestIdRef.current) return;
      setAttempts(nextAttempts);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setAttempts([]);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить историю попыток."));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [restaurantId, examId, selectedEmployeeUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { attempts, loading, error, reload };
}

import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    if (!restaurantId || !examId || !selectedEmployeeUserId) {
      setAttempts([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setAttempts(await getCertificationEmployeeAttempts(restaurantId, examId, selectedEmployeeUserId));
    } catch (e) {
      setAttempts([]);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить историю попыток."));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, examId, selectedEmployeeUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { attempts, loading, error, load };
}

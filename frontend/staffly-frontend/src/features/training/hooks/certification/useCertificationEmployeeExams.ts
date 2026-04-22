import { useCallback, useEffect, useRef, useState } from "react";
import { getCertificationEmployeeExams } from "../../api/trainingApi";
import type { CertificationEmployeeExamDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";

export function useCertificationEmployeeExams(
  restaurantId: number | null,
  userId: number | null,
) {
  const [exams, setExams] = useState<CertificationEmployeeExamDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!restaurantId || !userId) {
      requestIdRef.current += 1;
      setExams([]);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setExams([]);
    setLoading(true);
    setError(null);

    try {
      const response = await getCertificationEmployeeExams(restaurantId, userId);
      if (requestId !== requestIdRef.current) return;
      setExams(response);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setExams([]);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить аттестации сотрудника."));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [restaurantId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    exams,
    loading,
    error,
    reload,
  };
}

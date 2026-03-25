import { useCallback, useEffect, useState } from "react";
import { getCertificationExamSummary } from "../../api/trainingApi";
import type { CertificationExamSummaryDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";

export function useCertificationExamSummary(restaurantId: number | null, examId: number | null) {
  const [summary, setSummary] = useState<CertificationExamSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!restaurantId || !examId) {
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setSummary(await getCertificationExamSummary(restaurantId, examId));
    } catch (e) {
      setSummary(null);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить сводку по аттестации."));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, examId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { summary, loading, error, reload };
}

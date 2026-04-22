import { useCallback, useEffect, useRef, useState } from "react";
import { findCertificationEmployees } from "../../api/trainingApi";
import type { CertificationEmployeeSummaryDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";

export function useCertificationEmployeeSearch(
  restaurantId: number | null,
  positionId: number | null,
  query: string,
) {
  const [employees, setEmployees] = useState<CertificationEmployeeSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const hasFilters = positionId != null || query.trim().length > 0;

  const reload = useCallback(async () => {
    if (!restaurantId || !hasFilters) {
      requestIdRef.current += 1;
      setEmployees([]);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setEmployees([]);
    setLoading(true);
    setError(null);

    try {
      const response = await findCertificationEmployees(restaurantId, {
        positionId,
        q: query,
      });
      if (requestId !== requestIdRef.current) return;
      setEmployees(response);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setEmployees([]);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить сотрудников."));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [restaurantId, hasFilters, positionId, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    employees,
    loading,
    error,
    hasFilters,
    reload,
  };
}

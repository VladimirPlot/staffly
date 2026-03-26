import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCertificationExamEmployees } from "../../api/trainingApi";
import type { CertificationExamEmployeeRowDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";
import type { CertificationStatusFilter } from "./types";

export function useCertificationExamEmployees(
  restaurantId: number | null,
  examId: number | null,
  statusFilter: CertificationStatusFilter,
  search: string,
) {
  const [employees, setEmployees] = useState<CertificationExamEmployeeRowDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!restaurantId || !examId) {
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
      const nextEmployees = await getCertificationExamEmployees(restaurantId, examId);
      if (requestId !== requestIdRef.current) return;
      setEmployees(nextEmployees);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setEmployees([]);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить список сотрудников."));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [restaurantId, examId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filteredEmployees = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (statusFilter !== "ALL" && employee.status !== statusFilter) return false;
      if (!needle) return true;
      return employee.fullName.toLowerCase().includes(needle);
    });
  }, [employees, search, statusFilter]);

  return { employees: filteredEmployees, loading, error, reload };
}

import { useCallback, useEffect, useMemo, useState } from "react";
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

  const reload = useCallback(async () => {
    if (!restaurantId || !examId) {
      setEmployees([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setEmployees(await getCertificationExamEmployees(restaurantId, examId));
    } catch (e) {
      setEmployees([]);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить список сотрудников."));
    } finally {
      setLoading(false);
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

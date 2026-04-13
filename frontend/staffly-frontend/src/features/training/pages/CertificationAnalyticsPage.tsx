import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import CertificationAttemptsSection from "../components/certification/CertificationAttemptsSection";
import CertificationEmployeesSection from "../components/certification/CertificationEmployeesSection";
import CertificationOverviewSection from "../components/certification/CertificationOverviewSection";
import CertificationPositionsSection from "../components/certification/CertificationPositionsSection";
import { listExams } from "../api/trainingApi";
import type { TrainingExamDto } from "../api/types";
import type { CertificationStatusFilter } from "../hooks/certification/types";
import { useCertificationEmployeeAttempts } from "../hooks/certification/useCertificationEmployeeAttempts";
import { useCertificationExamEmployees } from "../hooks/certification/useCertificationExamEmployees";
import { useCertificationExamPositions } from "../hooks/certification/useCertificationExamPositions";
import { useCertificationExamSummary } from "../hooks/certification/useCertificationExamSummary";
import { useCertificationManagerActions } from "../hooks/certification/useCertificationManagerActions";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { parseTrainingApiError } from "../utils/trainingApiError";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

function resolveReturnTo(raw: string | null): string {
  if (!raw) return trainingRoutes.exams;
  let decoded: string = trainingRoutes.exams;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return trainingRoutes.exams;
  }
  if (!decoded.startsWith(trainingRoutes.exams)) return trainingRoutes.exams;
  return decoded;
}

export default function CertificationAnalyticsPage() {
  const navigate = useNavigate();
  const { examId } = useParams<{ examId: string }>();
  const [searchParams] = useSearchParams();
  const parsedExamId = Number(examId);
  const { restaurantId, canManage } = useTrainingAccess();
  const returnTo = resolveReturnTo(searchParams.get("returnTo"));

  const [exam, setExam] = useState<TrainingExamDto | null>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CertificationStatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedEmployeeUserId, setSelectedEmployeeUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!restaurantId || !Number.isFinite(parsedExamId)) {
      setExam(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setExamLoading(true);
      setExamError(null);
      try {
        const exams = await listExams(restaurantId, true, true);
        if (!cancelled) {
          setExam(exams.find((item) => item.id === parsedExamId) ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          const parsedError = parseTrainingApiError(error);
          if (parsedError.status === 403) {
            setExamError("Нет доступа к этой аттестации.");
          } else if (parsedError.status === 404) {
            setExamError("Аттестация не найдена.");
          } else {
            setExamError(getTrainingErrorMessage(error, "Не удалось загрузить аттестацию."));
          }
        }
      } finally {
        if (!cancelled) {
          setExamLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, parsedExamId]);

  const summaryState = useCertificationExamSummary(restaurantId, exam?.id ?? null);
  const positionsState = useCertificationExamPositions(restaurantId, exam?.id ?? null);
  const employeesState = useCertificationExamEmployees(restaurantId, exam?.id ?? null, statusFilter, search);
  const attemptsState = useCertificationEmployeeAttempts(restaurantId, exam?.id ?? null, selectedEmployeeUserId);

  const refresh = async () => {
    await Promise.all([
      summaryState.reload(),
      positionsState.reload(),
      employeesState.reload(),
      attemptsState.reload(),
    ]);
  };

  const managerActions = useCertificationManagerActions(restaurantId, exam?.id ?? null, refresh);

  const selectedEmployeeFullName = useMemo(
    () => employeesState.employees.find((employee) => employee.userId === selectedEmployeeUserId)?.fullName ?? null,
    [employeesState.employees, selectedEmployeeUserId],
  );

  if (!canManage) {
    return <ErrorState message="У вас нет доступа к аналитике аттестаций." onRetry={() => navigate(returnTo)} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Аттестации", to: returnTo }, { label: "Аналитика" }]} />

      {examLoading && <LoadingState label="Загрузка аналитики..." />}
      {examError && <ErrorState message={examError} onRetry={() => navigate(returnTo)} />}
      {!examLoading && !examError && !exam && <ErrorState message="Аттестация не найдена." onRetry={() => navigate(returnTo)} />}

      {exam && (
        <div className="space-y-4">
          <CertificationOverviewSection canManage exam={exam} summaryState={summaryState} managerActions={managerActions} />
          <CertificationPositionsSection hasSelectedExam positionsState={positionsState} />
          <CertificationEmployeesSection
            canManage
            hasSelectedExam
            employeesState={employeesState}
            managerActions={managerActions}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            search={search}
            onSearchChange={setSearch}
            onShowAttempts={setSelectedEmployeeUserId}
          />
          <CertificationAttemptsSection selectedEmployeeFullName={selectedEmployeeFullName} attemptsState={attemptsState} />
        </div>
      )}
    </div>
  );
}

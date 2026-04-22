import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ErrorState from "../components/ErrorState";
import CertificationAttemptHistoryList from "../components/certification/CertificationAttemptHistoryList";
import CertificationStatusBadge from "../components/certification/CertificationStatusBadge";
import { useCertificationEmployeeAttempts } from "../hooks/certification/useCertificationEmployeeAttempts";
import { useCertificationEmployeeExams } from "../hooks/certification/useCertificationEmployeeExams";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { formatDateTime } from "../utils/certificationResultFormatting";
import { trainingRoutes } from "../utils/trainingRoutes";

function parseCounter(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CertificationEmployeeAnalyticsPage() {
  const { userId } = useParams<{ userId: string }>();
  const parsedUserId = Number(userId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canManage, restaurantId } = useTrainingAccess();
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  const returnTo = useMemo(() => {
    const raw = searchParams.get("returnTo");
    if (!raw) return trainingRoutes.exams;
    return raw.startsWith(trainingRoutes.exams) ? raw : trainingRoutes.exams;
  }, [searchParams]);

  const fullName = searchParams.get("fullName")?.trim() || "Сотрудник";
  const positionName = searchParams.get("positionName")?.trim() || "Должность не указана";
  const assignedCount = parseCounter(searchParams.get("assignedCount"));
  const completedCount = parseCounter(searchParams.get("completedCount"));
  const passedCount = parseCounter(searchParams.get("passedCount"));
  const failedCount = parseCounter(searchParams.get("failedCount"));

  const examsState = useCertificationEmployeeExams(
    canManage && Number.isFinite(parsedUserId) ? restaurantId : null,
    Number.isFinite(parsedUserId) ? parsedUserId : null,
  );

  const attemptsState = useCertificationEmployeeAttempts(
    canManage && Number.isFinite(parsedUserId) ? restaurantId : null,
    selectedExamId,
    Number.isFinite(parsedUserId) ? parsedUserId : null,
  );

  if (!canManage) {
    return <ErrorState message="У вас нет доступа к статистике по сотрудникам." onRetry={() => navigate(returnTo)} />;
  }

  if (!Number.isFinite(parsedUserId)) {
    return <ErrorState message="Сотрудник не найден." onRetry={() => navigate(returnTo)} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Breadcrumbs
        items={[
          { label: "Тренинг", to: trainingRoutes.landing },
          { label: "Аттестации", to: returnTo },
          { label: "Статистика по сотрудникам" },
        ]}
      />

      <Card className="space-y-3">
        <div className="text-xl font-semibold text-default">{fullName}</div>
        <div className="text-sm text-muted">{positionName}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted md:grid-cols-4">
          <div>Назначено: {assignedCount}</div>
          <div>Завершено: {completedCount}</div>
          <div>Сдано: {passedCount}</div>
          <div>Не сдано: {failedCount}</div>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="text-sm font-semibold">Текущие активные аттестации</div>

        {examsState.loading && <div className="text-sm text-muted">Загрузка аттестаций...</div>}
        {examsState.error && <ErrorState message={examsState.error} onRetry={() => void examsState.reload()} />}

        {!examsState.loading && !examsState.error && examsState.exams.length === 0 && (
          <div className="text-sm text-muted">Активных аттестаций для сотрудника не найдено.</div>
        )}

        {!examsState.loading && !examsState.error && examsState.exams.length > 0 && (
          <div className="space-y-3">
            {examsState.exams.map((exam) => {
              const isAttemptsOpen = selectedExamId === exam.examId;
              const employeeDetailPathWithSearch = `${trainingRoutes.employeeCertificationAnalytics(parsedUserId)}?${searchParams.toString()}`;

              return (
                <div key={exam.examId} className="rounded-xl border border-subtle p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-default">{exam.examTitle}</div>
                      <div className="text-sm text-muted">
                        Лучший балл: {exam.bestScore ?? "—"}% · Последняя попытка: {formatDateTime(exam.lastAttemptAt)}
                      </div>
                      <div className="text-sm text-muted">
                        Попытки: {exam.attemptsUsed ?? 0} / {exam.attemptsAllowed ?? "∞"}
                      </div>
                    </div>
                    <CertificationStatusBadge status={exam.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedExamId((prev) => (prev === exam.examId ? null : exam.examId));
                      }}
                    >
                      История попыток
                    </Button>
                  </div>

                  {isAttemptsOpen && (
                    <div className="mt-3 border-t border-subtle pt-3">
                      <CertificationAttemptHistoryList
                        examId={exam.examId}
                        userId={parsedUserId}
                        attempts={attemptsState.attempts}
                        loading={attemptsState.loading}
                        error={attemptsState.error}
                        returnTo={employeeDetailPathWithSearch}
                        onRetry={() => void attemptsState.reload()}
                        emptyLabel="Попыток по этой аттестации пока нет."
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

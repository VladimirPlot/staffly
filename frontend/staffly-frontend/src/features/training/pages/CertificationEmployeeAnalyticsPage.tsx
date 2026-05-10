import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ErrorState from "../components/ErrorState";
import CertificationAttemptHistoryList from "../components/certification/CertificationAttemptHistoryList";
import CertificationStatusBadge from "../components/certification/CertificationStatusBadge";
import { useCertificationEmployeeAttempts } from "../hooks/certification/useCertificationEmployeeAttempts";
import { useCertificationEmployeeExams } from "../hooks/certification/useCertificationEmployeeExams";
import { useCertificationEmployeeSummary } from "../hooks/certification/useCertificationEmployeeSummary";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { formatDateTime } from "../utils/certificationResultFormatting";
import {
  normalizeTrainingExamsReturnTo,
  withReturnToParam,
} from "../utils/returnTo";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function CertificationEmployeeAnalyticsPage() {
  const { userId } = useParams<{ userId: string }>();
  const parsedUserId = Number(userId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canManage, restaurantId } = useTrainingAccess();

  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  const returnTo = useMemo(
    () => normalizeTrainingExamsReturnTo(searchParams.get("returnTo")),
    [searchParams],
  );

  const summaryState = useCertificationEmployeeSummary(
    canManage && Number.isFinite(parsedUserId) ? restaurantId : null,
    Number.isFinite(parsedUserId) ? parsedUserId : null,
  );

  const examsState = useCertificationEmployeeExams(
    canManage && Number.isFinite(parsedUserId) ? restaurantId : null,
    Number.isFinite(parsedUserId) ? parsedUserId : null,
  );

  const employeeDetailPath = withReturnToParam(
    trainingRoutes.employeeCertificationAnalytics(parsedUserId),
    returnTo,
  );

  const validSelectedExamId = useMemo(() => {
    if (selectedExamId == null) {
      return null;
    }

    return examsState.exams.some((exam) => exam.examId === selectedExamId)
      ? selectedExamId
      : null;
  }, [examsState.exams, selectedExamId]);

  useEffect(() => {
    if (selectedExamId != null && validSelectedExamId == null) {
      setSelectedExamId(null);
    }
  }, [selectedExamId, validSelectedExamId]);

  const attemptsState = useCertificationEmployeeAttempts(
    canManage && Number.isFinite(parsedUserId) ? restaurantId : null,
    validSelectedExamId,
    Number.isFinite(parsedUserId) ? parsedUserId : null,
  );

  if (!canManage) {
    return (
      <ErrorState
        message="У вас нет доступа к статистике по сотрудникам."
        onRetry={() => navigate(returnTo)}
      />
    );
  }

  if (!Number.isFinite(parsedUserId)) {
    return (
      <ErrorState
        message="Сотрудник не найден."
        onRetry={() => navigate(returnTo)}
      />
    );
  }

  const summary = summaryState.summary;

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
        {summaryState.loading && (
          <div className="text-sm text-muted">Загрузка сводки сотрудника...</div>
        )}
        {summaryState.error && (
          <ErrorState
            message={summaryState.error}
            onRetry={() => void summaryState.reload()}
          />
        )}

        {!summaryState.loading && !summaryState.error && summary && (
          <>
            <div className="text-xl font-semibold text-default">
              {summary.fullName || "Сотрудник"}
            </div>
            <div className="text-sm text-muted">
              {summary.positionName?.trim() || "Должность не указана"}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted md:grid-cols-4">
              <div>Назначено: {summary.assignedCount}</div>
              <div>Завершено: {summary.completedCount}</div>
              <div>Сдано: {summary.passedCount}</div>
              <div>Не сдано: {summary.failedCount}</div>
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="text-sm font-semibold">Текущие активные аттестации</div>

        {examsState.loading && (
          <div className="text-sm text-muted">Загрузка аттестаций...</div>
        )}
        {examsState.error && (
          <ErrorState
            message={examsState.error}
            onRetry={() => void examsState.reload()}
          />
        )}

        {!examsState.loading && !examsState.error && examsState.exams.length === 0 && (
          <div className="text-sm text-muted">
            Активных аттестаций для сотрудника не найдено.
          </div>
        )}

        {!examsState.loading && !examsState.error && examsState.exams.length > 0 && (
          <div className="space-y-3">
            {examsState.exams.map((exam) => {
              const isAttemptsOpen = validSelectedExamId === exam.examId;

              return (
                <div
                  key={exam.examId}
                  className="rounded-xl border border-subtle p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-default">
                        {exam.examTitle}
                      </div>
                      <div className="text-sm text-muted">
                        Лучший балл: {exam.bestScore ?? "—"}% · Последняя попытка:{" "}
                        {formatDateTime(exam.lastAttemptAt)}
                      </div>
                      <div className="text-sm text-muted">
                        Попытки: {exam.attemptsUsed ?? 0} /{" "}
                        {exam.attemptsAllowed ?? "∞"}
                      </div>
                    </div>

                    <CertificationStatusBadge status={exam.analyticsStatus} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedExamId((prev) =>
                          prev === exam.examId ? null : exam.examId,
                        );
                      }}
                    >
                      {isAttemptsOpen ? "Скрыть историю" : "История попыток"}
                    </Button>
                  </div>

                  {isAttemptsOpen && (
                    <div className="mt-3 border-t border-subtle pt-3">
                      <CertificationAttemptHistoryList
                        examId={exam.examId}
                        attempts={attemptsState.attempts}
                        loading={attemptsState.loading}
                        error={attemptsState.error}
                        returnTo={employeeDetailPath}
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

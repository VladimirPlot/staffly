import { Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import ExamEditorModal from "../components/ExamEditorModal";
import LoadingState from "../components/LoadingState";
import CertificationStatusBadge from "../components/certification/CertificationStatusBadge";
import CertificationSummaryCards from "../components/certification/CertificationSummaryCards";
import { deleteExam, hideExam, listExams, restoreExam } from "../api/trainingApi";
import type { CertificationAssignmentStatus, TrainingExamDto } from "../api/types";
import { useCertificationEmployeeAttempts } from "../hooks/certification/useCertificationEmployeeAttempts";
import { useCertificationExamEmployees } from "../hooks/certification/useCertificationExamEmployees";
import { useCertificationExamPositions } from "../hooks/certification/useCertificationExamPositions";
import { useCertificationExamSummary } from "../hooks/certification/useCertificationExamSummary";
import { useCertificationManagerActions } from "../hooks/certification/useCertificationManagerActions";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

type StatusFilter = "ALL" | CertificationAssignmentStatus;

export default function ExamsPage() {
  const { restaurantId, canManage } = useTrainingAccess();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [exams, setExams] = useState<TrainingExamDto[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [loadingExamActionId, setLoadingExamActionId] = useState<number | null>(null);

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId) ?? null,
    [exams, selectedExamId],
  );

  const loadExams = useCallback(async () => {
    if (!restaurantId) return;
    setLoadingExams(true);
    setExamsError(null);
    try {
      const response = await listExams(restaurantId, canManage ? includeInactive : false, true);
      setExams(response);
      setSelectedExamId((current) => {
        if (current && response.some((exam) => exam.id === current)) return current;
        return response[0]?.id ?? null;
      });
    } catch (e) {
      setExamsError(getTrainingErrorMessage(e, "Не удалось загрузить аттестации."));
    } finally {
      setLoadingExams(false);
    }
  }, [restaurantId, canManage, includeInactive]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const summaryState = useCertificationExamSummary(restaurantId, selectedExamId);
  const positionsState = useCertificationExamPositions(restaurantId, selectedExamId);
  const employeesState = useCertificationExamEmployees(restaurantId, selectedExamId, statusFilter, search);
  const attemptsState = useCertificationEmployeeAttempts(restaurantId, selectedExamId);
  const loadEmployeeAttempts = attemptsState.load;

  const refreshWorkspace = async () => {
    await Promise.all([
      summaryState.reload(),
      positionsState.reload(),
      employeesState.reload(),
      loadEmployeeAttempts(selectedEmployeeId),
      loadExams(),
    ]);
  };

  const managerActions = useCertificationManagerActions(restaurantId, selectedExamId, refreshWorkspace);

  useEffect(() => {
    void loadEmployeeAttempts(selectedEmployeeId);
  }, [loadEmployeeAttempts, selectedEmployeeId, selectedExamId]);

  const runExamAction = async (examId: number, action: "hide" | "restore" | "delete") => {
    if (!restaurantId) return;
    setLoadingExamActionId(examId);
    setExamsError(null);
    try {
      if (action === "hide") await hideExam(restaurantId, examId);
      else if (action === "restore") await restoreExam(restaurantId, examId);
      else await deleteExam(restaurantId, examId);
      await loadExams();
    } catch (e) {
      setExamsError(getTrainingErrorMessage(e, "Не удалось выполнить действие с аттестацией."));
    } finally {
      setLoadingExamActionId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Аттестации" }]} />
      <h2 className="text-2xl font-semibold">Аттестации</h2>

      {canManage && (
        <div className="border-subtle bg-surface rounded-2xl border p-3 flex items-center justify-between gap-3">
          <Switch label="Скрытые элементы" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />
          <Button variant="outline" onClick={() => setModalOpen(true)}><Plus className="mr-2 h-4 w-4" />Создать аттестацию</Button>
        </div>
      )}

      {loadingExams && <LoadingState label="Загрузка аттестаций..." />}
      {examsError && <ErrorState message={examsError} onRetry={loadExams} />}

      {!loadingExams && !examsError && exams.length === 0 && (
        <EmptyState title="Нет аттестаций" description="Создайте первую аттестацию." />
      )}

      {!loadingExams && exams.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="space-y-2 h-fit">
            <div className="text-sm font-semibold">Список аттестаций</div>
            {exams.map((exam) => (
              <div key={exam.id} className={`rounded-xl border p-3 ${selectedExamId === exam.id ? "border-primary" : "border-subtle"}`}>
                <button type="button" onClick={() => { setSelectedExamId(exam.id); setSelectedEmployeeId(null); }} className="w-full text-left">
                  <div className="font-medium text-default">{exam.title}</div>
                  <div className="text-xs text-muted">Вопросов: {exam.questionCount} · Проходной: {exam.passPercent}%</div>
                  {!exam.active && <div className="mt-1 text-xs text-amber-700">Скрыт</div>}
                </button>
                {canManage && (
                  <div className="mt-2 flex gap-2">
                    {exam.active ? (
                      <Button size="sm" variant="outline" isLoading={loadingExamActionId === exam.id} onClick={() => runExamAction(exam.id, "hide")}>Скрыть</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" isLoading={loadingExamActionId === exam.id} onClick={() => runExamAction(exam.id, "restore")}>Восстановить</Button>
                        <Button size="sm" variant="outline" isLoading={loadingExamActionId === exam.id} onClick={() => runExamAction(exam.id, "delete")}>Удалить</Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Card>

          <div className="space-y-4">
            {selectedExam && (
              <Card className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{selectedExam.title}</div>
                    <div className="text-sm text-muted">Assignment-aware аналитика аттестации</div>
                  </div>
                  {canManage && (
                    <Button variant="outline" isLoading={managerActions.loadingActionKey === "reset:exam"} onClick={() => void managerActions.resetExam()}>
                      <Icon icon={RotateCcw} size="sm" /> <span className="ml-2">Глобально сбросить цикл</span>
                    </Button>
                  )}
                </div>
                {managerActions.error && <div className="text-sm text-red-600">{managerActions.error}</div>}
                {summaryState.loading && <LoadingState label="Загрузка сводки..." />}
                {summaryState.error && <ErrorState message={summaryState.error} onRetry={summaryState.reload} />}
                {summaryState.summary && <CertificationSummaryCards summary={summaryState.summary} />}
              </Card>
            )}

            <Card className="space-y-3">
              <div className="text-sm font-semibold">Статистика по должностям</div>
              {positionsState.loading && <LoadingState label="Загрузка статистики..." />}
              {positionsState.error && <ErrorState message={positionsState.error} onRetry={positionsState.reload} />}
              {!positionsState.loading && positionsState.positions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-muted">
                      <tr>
                        <th className="px-2 py-1 text-left">Должность</th>
                        <th className="px-2 py-1 text-right">Назначено</th>
                        <th className="px-2 py-1 text-right">Сдано</th>
                        <th className="px-2 py-1 text-right">Не начато</th>
                        <th className="px-2 py-1 text-right">% прохождения</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionsState.positions.map((position) => (
                        <tr key={position.positionId} className="border-t border-subtle">
                          <td className="px-2 py-2">{position.positionName}</td>
                          <td className="px-2 py-2 text-right">{position.assignedCount}</td>
                          <td className="px-2 py-2 text-right">{position.passedCount}</td>
                          <td className="px-2 py-2 text-right">{position.notStartedCount}</td>
                          <td className="px-2 py-2 text-right">{typeof position.passRate === "number" ? `${position.passRate}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="text-sm font-semibold">Сотрудники</div>
                <div className="flex flex-wrap gap-2">
                  <input className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по ФИО" />
                  <select className="rounded-xl border border-subtle bg-surface px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                    <option value="ALL">Все статусы</option>
                    <option value="ASSIGNED">Не начато</option>
                    <option value="IN_PROGRESS">В процессе</option>
                    <option value="PASSED">Сдано</option>
                    <option value="FAILED">Не сдано</option>
                    <option value="EXHAUSTED">Лимит исчерпан</option>
                    <option value="ARCHIVED">Архив</option>
                  </select>
                </div>
              </div>

              {employeesState.loading && <LoadingState label="Загрузка сотрудников..." />}
              {employeesState.error && <ErrorState message={employeesState.error} onRetry={employeesState.reload} />}

              {!employeesState.loading && employeesState.employees.length > 0 && (
                <div className="space-y-2">
                  {employeesState.employees.map((employee) => (
                    <div key={employee.assignmentId} className="rounded-xl border border-subtle p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{employee.fullName}</div>
                          <div className="text-xs text-muted">Попытки: {employee.attemptsUsed} / {employee.attemptsAllowed ?? "∞"} · Лучший балл: {employee.bestScore ?? "—"}%</div>
                        </div>
                        <CertificationStatusBadge status={employee.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedEmployeeId(employee.userId)}>История попыток</Button>
                        {canManage && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              isLoading={managerActions.loadingActionKey === `grant:${employee.userId}`}
                              onClick={() => void managerActions.grantEmployeeAttempt(employee.userId)}
                            >
                              +1 попытка
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              isLoading={managerActions.loadingActionKey === `reset:${employee.userId}`}
                              onClick={() => void managerActions.resetEmployee(employee.userId)}
                            >
                              Сбросить попытки
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {selectedEmployeeId && (
              <Card className="space-y-3">
                <div className="text-sm font-semibold">История попыток сотрудника #{selectedEmployeeId}</div>
                {attemptsState.loading && <LoadingState label="Загрузка попыток..." />}
                {attemptsState.error && <ErrorState message={attemptsState.error} onRetry={() => attemptsState.load(selectedEmployeeId)} />}
                {!attemptsState.loading && attemptsState.attempts.length === 0 && (
                  <div className="text-sm text-muted">Попыток пока нет.</div>
                )}
                {!attemptsState.loading && attemptsState.attempts.length > 0 && (
                  <div className="space-y-2 text-sm">
                    {attemptsState.attempts.map((attempt) => (
                      <div key={attempt.attemptId} className="rounded-xl border border-subtle p-2">
                        <div>Попытка #{attempt.attemptId}</div>
                        <div className="text-muted">Старт: {new Date(attempt.startedAt).toLocaleString()}</div>
                        <div className="text-muted">Финиш: {attempt.finishedAt ? new Date(attempt.finishedAt).toLocaleString() : "—"}</div>
                        <div className="text-muted">Результат: {typeof attempt.scorePercent === "number" ? `${attempt.scorePercent}%` : "—"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {restaurantId && (
        <ExamEditorModal
          open={modalOpen}
          restaurantId={restaurantId}
          mode="CERTIFICATION"
          onClose={() => setModalOpen(false)}
          onSaved={loadExams}
        />
      )}
    </div>
  );
}

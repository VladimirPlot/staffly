import { Link } from "react-router-dom";
import type { CurrentUserCertificationExamDto } from "../../api/types";
import { trainingRoutes } from "../../utils/trainingRoutes";
import CertificationStatusBadge from "./CertificationStatusBadge";

type Props = {
  exam: CurrentUserCertificationExamDto;
};

function formatDuration(seconds?: number | null): string {
  if (seconds == null) return "Без ограничения";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} мин`;
}

export default function CertificationMyExamCard({ exam }: Props) {
  const resultText = exam.bestScore == null ? null : `${exam.bestScore}%`;
  const attemptsText = exam.attemptsAllowed == null
    ? `${exam.attemptsUsed}/∞`
    : `${exam.attemptsUsed}/${exam.attemptsAllowed}`;
  const attemptsDetailsText = exam.baseAttemptLimit == null
    ? `Дополнительные попытки: +${exam.extraAttempts}`
    : `Базовый лимит: ${exam.baseAttemptLimit} · Дополнительные: +${exam.extraAttempts}`;
  const hasAttemptsLeft = exam.attemptsAllowed == null || exam.attemptsUsed < exam.attemptsAllowed;
  const hasInProgressAttempt = exam.assignmentStatus === "IN_PROGRESS";
  const hasFinishedAttempt = exam.assignmentStatus === "FAILED" || exam.assignmentStatus === "EXHAUSTED" || exam.assignmentStatus === "PASSED";
  const canRestart = hasFinishedAttempt && exam.assignmentStatus !== "PASSED" && hasAttemptsLeft;

  return (
    <div className="rounded-xl border border-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-default">{exam.title}</div>
          {exam.description && <div className="mt-1 text-sm text-muted">{exam.description}</div>}
        </div>
        <CertificationStatusBadge status={exam.assignmentStatus} />
      </div>

      {!exam.active && (
        <div className="mt-2 text-xs text-amber-700">
          Скрыта в управлении, но доступна по вашему назначению
        </div>
      )}

      <div className="mt-2 text-sm text-muted">
        Вопросов: {exam.questionCount} · Проходной: {exam.passPercent}% · Попыток: {attemptsText} · Время: {formatDuration(exam.timeLimitSec)}
      </div>
      <div className="mt-1 text-sm text-muted">{attemptsDetailsText}</div>

      <div className="mt-2 text-sm text-muted">
        {resultText ? `Лучший результат: ${resultText}` : "Итогового результата пока нет"}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!hasFinishedAttempt && !hasInProgressAttempt && (
          <Link to={trainingRoutes.examRun(exam.examId)} className="inline-flex items-center rounded-xl border border-subtle px-3 py-2 text-sm font-medium text-default hover:bg-app">
            Начать аттестацию
          </Link>
        )}

        {hasInProgressAttempt && (
          <Link to={trainingRoutes.examRun(exam.examId)} className="inline-flex items-center rounded-xl border border-subtle px-3 py-2 text-sm font-medium text-default hover:bg-app">
            Продолжить аттестацию
          </Link>
        )}

        {hasFinishedAttempt && (
          <Link to={trainingRoutes.examResult(exam.examId)} className="inline-flex items-center rounded-xl border border-subtle px-3 py-2 text-sm font-medium text-default hover:bg-app">
            Посмотреть результат
          </Link>
        )}

        {canRestart && (
          <Link to={trainingRoutes.examRun(exam.examId)} className="inline-flex items-center rounded-xl border border-subtle px-3 py-2 text-sm font-medium text-default hover:bg-app">
            Перезапустить
          </Link>
        )}
      </div>
    </div>
  );
}

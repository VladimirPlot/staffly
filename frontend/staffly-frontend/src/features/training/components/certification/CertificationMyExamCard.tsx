import { Link } from "react-router-dom";
import type { CurrentUserCertificationExamDto } from "../../api/types";
import { trainingRoutes } from "../../utils/trainingRoutes";
import { cn } from "../../../../shared/lib/cn";
import CertificationStatusBadge from "./CertificationStatusBadge";
import { formatTrainingDuration } from "../../utils/duration";

type Props = {
  exam: CurrentUserCertificationExamDto;
};

export default function CertificationMyExamCard({ exam }: Props) {
  const resultText = exam.bestScore == null ? null : `${exam.bestScore}%`;
  const attemptsText =
    exam.attemptsAllowed == null ? `${exam.attemptsUsed}/∞` : `${exam.attemptsUsed}/${exam.attemptsAllowed}`;
  const attemptsDetailsText =
    exam.baseAttemptLimit == null
      ? `Дополнительные попытки: +${exam.extraAttempts}`
      : `Базовый лимит: ${exam.baseAttemptLimit} · Дополнительные: +${exam.extraAttempts}`;
  const hasAttemptsLeft = exam.attemptsAllowed == null || exam.attemptsUsed < exam.attemptsAllowed;
  const hasInProgressAttempt = exam.assignmentStatus === "IN_PROGRESS";
  const hasFinishedAttempt =
    exam.assignmentStatus === "FAILED" || exam.assignmentStatus === "EXHAUSTED" || exam.assignmentStatus === "PASSED";
  const canRestart = hasFinishedAttempt && exam.assignmentStatus !== "PASSED" && hasAttemptsLeft;
  const primaryAction = hasFinishedAttempt
    ? { href: trainingRoutes.examResult(exam.examId), label: "Посмотреть результат" }
    : hasInProgressAttempt
      ? { href: trainingRoutes.examRun(exam.examId), label: "Продолжить аттестацию" }
      : { href: trainingRoutes.examRun(exam.examId), label: "Начать аттестацию" };
  const secondaryAction = canRestart ? { href: trainingRoutes.examRun(exam.examId), label: "Перезапустить" } : null;
  const statItems = [
    { label: "Вопросов", value: String(exam.questionCount) },
    { label: "Проходной", value: `${exam.passPercent}%` },
    { label: "Попыток", value: attemptsText },
    { label: "Время", value: formatTrainingDuration(exam.timeLimitSec) },
  ];

  return (
    <article className="border-subtle bg-surface rounded-3xl border p-4 shadow-[var(--staffly-shadow)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-strong text-base font-semibold [overflow-wrap:anywhere] sm:text-lg">{exam.title}</div>
          {exam.description && (
            <p className="text-muted mt-1 max-w-3xl text-xs text-pretty [overflow-wrap:anywhere] sm:text-sm">
              {exam.description}
            </p>
          )}
        </div>
        <CertificationStatusBadge status={exam.assignmentStatus} />
      </div>

      {!exam.active && (
        <div className="mt-3 inline-flex rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Скрыта в управлении, но доступна по вашему назначению
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {statItems.map((item) => (
          <div key={item.label} className="border-subtle bg-app rounded-2xl border px-2.5 py-2 sm:px-3">
            <dt className="text-muted text-[11px] leading-tight">{item.label}</dt>
            <dd className="text-default mt-0.5 text-sm font-medium [overflow-wrap:anywhere] tabular-nums">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="text-muted mt-3 text-xs sm:text-sm">{attemptsDetailsText}</div>
      <div className="text-muted mt-1 text-xs sm:text-sm">
        {resultText ? `Лучший результат: ${resultText}` : "Итогового результата пока нет"}
      </div>
      <div className="text-muted mt-1 text-xs sm:text-sm">
        Назначена версия {exam.examVersionSnapshot ?? "—"}
        {exam.assignmentCycleSequence != null && ` · цикл ${exam.assignmentCycleSequence}`}
        {exam.latestPublishedVersion !== exam.examVersionSnapshot &&
          ` · опубликована версия ${exam.latestPublishedVersion}`}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          to={primaryAction.href}
          className={cn(
            "bg-surface text-default hover:bg-app focus:ring-default inline-flex w-full items-center justify-center rounded-2xl border border-[color:var(--staffly-brand-border)] px-4 py-2 text-sm font-medium shadow-sm transition hover:border-[color:var(--staffly-divider)] focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--staffly-surface)] focus:outline-none sm:w-auto",
          )}
        >
          {primaryAction.label}
        </Link>

        {secondaryAction && (
          <Link
            to={secondaryAction.href}
            className={cn(
              "border-subtle bg-surface text-default hover:bg-app focus:ring-default inline-flex w-full items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--staffly-surface)] focus:outline-none sm:w-auto",
            )}
          >
            {secondaryAction.label}
          </Link>
        )}
      </div>
    </article>
  );
}

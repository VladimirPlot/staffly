import { Link } from "react-router-dom";
import type { CurrentUserCertificationExamDto } from "../../api/types";
import { trainingRoutes } from "../../utils/trainingRoutes";
import { cn } from "../../../../shared/lib/cn";
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
  const attemptsText = exam.attemptsAllowed == null ? `${exam.attemptsUsed}/∞` : `${exam.attemptsUsed}/${exam.attemptsAllowed}`;
  const attemptsDetailsText = exam.baseAttemptLimit == null
    ? `Дополнительные попытки: +${exam.extraAttempts}`
    : `Базовый лимит: ${exam.baseAttemptLimit} · Дополнительные: +${exam.extraAttempts}`;
  const hasAttemptsLeft = exam.attemptsAllowed == null || exam.attemptsUsed < exam.attemptsAllowed;
  const hasInProgressAttempt = exam.assignmentStatus === "IN_PROGRESS";
  const hasFinishedAttempt = exam.assignmentStatus === "FAILED" || exam.assignmentStatus === "EXHAUSTED" || exam.assignmentStatus === "PASSED";
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
    { label: "Время", value: formatDuration(exam.timeLimitSec) },
  ];

  return (
    <article className="rounded-3xl border border-subtle bg-surface p-4 shadow-[var(--staffly-shadow)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-strong sm:text-lg [overflow-wrap:anywhere]">{exam.title}</div>
          {exam.description && <p className="mt-1 max-w-3xl text-pretty text-xs text-muted sm:text-sm [overflow-wrap:anywhere]">{exam.description}</p>}
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
          <div key={item.label} className="rounded-2xl border border-subtle bg-app px-2.5 py-2 sm:px-3">
            <dt className="text-[11px] leading-tight text-muted">{item.label}</dt>
            <dd className="mt-0.5 tabular-nums text-sm font-medium text-default [overflow-wrap:anywhere]">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 text-xs text-muted sm:text-sm">{attemptsDetailsText}</div>
      <div className="mt-1 text-xs text-muted sm:text-sm">
        {resultText ? `Лучший результат: ${resultText}` : "Итогового результата пока нет"}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          to={primaryAction.href}
          className={cn(
            "inline-flex w-full items-center justify-center rounded-2xl border border-[color:var(--staffly-brand-border)] bg-surface px-4 py-2 text-sm font-medium text-default shadow-sm transition hover:border-[color:var(--staffly-divider)] hover:bg-app focus:outline-none focus:ring-2 focus:ring-default focus:ring-offset-2 focus:ring-offset-[var(--staffly-surface)] sm:w-auto",
          )}
        >
          {primaryAction.label}
        </Link>

        {secondaryAction && (
          <Link
            to={secondaryAction.href}
            className={cn(
              "inline-flex w-full items-center justify-center rounded-2xl border border-subtle bg-surface px-4 py-2 text-sm font-medium text-default transition hover:bg-app focus:outline-none focus:ring-2 focus:ring-default focus:ring-offset-2 focus:ring-offset-[var(--staffly-surface)] sm:w-auto",
            )}
          >
            {secondaryAction.label}
          </Link>
        )}
      </div>
    </article>
  );
}

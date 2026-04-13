import type { ReactNode } from "react";
import Button from "../../../../shared/ui/Button";
import Card from "../../../../shared/ui/Card";
import type { ExamAttemptDto, ExamSubmitResultDto } from "../../api/types";

type Props = {
  attempt: ExamAttemptDto;
  currentIndex: number;
  remainingSec: number | null;
  formatRemainingTime: (seconds: number) => string;
  questionContent?: ReactNode;
  questionError: string | null;
  timeExpired: boolean;
  result: ExamSubmitResultDto | null;
  isCurrentQuestionConfirmed: boolean;
  submitting: boolean;
  onConfirm: () => void;
  onNext: () => void;
  onExit: () => void;
  onRestart?: () => void;
  onFinish: () => void;
  disableConfirm: boolean;
};

export default function ExamRunLayout({
  attempt,
  currentIndex,
  remainingSec,
  formatRemainingTime,
  questionContent,
  questionError,
  timeExpired,
  result,
  isCurrentQuestionConfirmed,
  submitting,
  onConfirm,
  onNext,
  onExit,
  onRestart,
  onFinish,
  disableConfirm,
}: Props) {
  return (
    <Card className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 border-b border-subtle bg-surface px-4 py-3">
        <div className="text-lg font-semibold text-default">{attempt.exam.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>Вопрос {Math.min(currentIndex + 1, attempt.questions.length)} / {attempt.questions.length}</span>
          {remainingSec != null && <span>Осталось: {formatRemainingTime(remainingSec)}</span>}
        </div>
        {attempt.exam.description && <div className="mt-1 text-sm text-muted">{attempt.exam.description}</div>}
      </div>

      {!result && questionContent}
      {!result && questionError && <div className="text-sm text-rose-600">{questionError}</div>}
      {!result && timeExpired && <div className="text-sm text-rose-600">Время вышло, завершаем тест…</div>}

      {!result && (
        <div className="flex flex-wrap gap-2">
          {!isCurrentQuestionConfirmed ? (
            <Button onClick={onConfirm} isLoading={submitting} disabled={submitting || timeExpired || disableConfirm}>
              Отправить ответ
            </Button>
          ) : (
            <Button onClick={onNext} isLoading={submitting} disabled={submitting || timeExpired}>
              {currentIndex === attempt.questions.length - 1 ? "Завершить тест" : "Далее"}
            </Button>
          )}

          <Button variant="outline" onClick={onExit}>К списку</Button>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className={`rounded-2xl p-3 text-sm ${result.passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            {result.passed ? "Поздравляем! Тест пройден." : "Тест не пройден."} Результат: {result.scorePercent}%.
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onFinish}>Завершить</Button>
            {onRestart && <Button variant="outline" onClick={onRestart}>Повторить</Button>}
          </div>
        </div>
      )}
    </Card>
  );
}

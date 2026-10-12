import { useEffect, useRef } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import ExamRunLayout from "./examRun/ExamRunLayout";
import QuestionRenderer from "./examRun/QuestionRenderer";
import { useExamRunState } from "./examRun/useExamRunState";

export default function ExamRunPage() {
  const { examId, folderId } = useParams<{ examId: string; folderId?: string }>();
  const parsedExamId = Number(examId);
  const parsedFolderId = folderId ? Number(folderId) : null;
  const { restaurantId } = useTrainingAccess();
  return (
    <ExamRunScreen
      key={`${restaurantId}:${parsedExamId}:${parsedFolderId}`}
      restaurantId={restaurantId ?? undefined}
      examId={parsedExamId}
      folderId={Number.isFinite(parsedFolderId) ? parsedFolderId : null}
    />
  );
}

export function ExamRunScreen({
  restaurantId,
  examId,
  folderId,
}: {
  restaurantId?: number;
  examId: number;
  folderId: number | null;
}) {
  const navigate = useNavigate();
  const state = useExamRunState({
    restaurantId,
    examId,
    folderId,
    navigate,
  });
  const shouldWarnOnExit = Boolean(state.attempt && !state.result) || state.loading;
  const exitGuardRef = useRef(shouldWarnOnExit);
  exitGuardRef.current = shouldWarnOnExit;
  const blocker = useBlocker(() => exitGuardRef.current);
  useEffect(() => {
    if (!shouldWarnOnExit) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldWarnOnExit]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={state.breadcrumbItems} />
      <h2 className="text-default text-2xl font-semibold">Прохождение теста</h2>

      {state.loading && <LoadingState label="Запускаем тест…" />}
      {state.error && <ErrorState message={state.error} onRetry={state.retry} />}

      {!state.attempt && !state.loading && !state.error && folderId == null && (
        <Card className="space-y-4">
          <h3 className="text-lg font-semibold">Перед аттестацией</h3>
          <p>
            Новая попытка начнётся только после нажатия кнопки ниже. Если у вас уже есть незавершённая попытка, вы
            продолжите её.
          </p>
          <ul className="text-default list-disc space-y-2 pl-5 text-sm">
            <li>
              Если установлен таймер, он продолжает идти после выхода и закрытия страницы. Возобновление не сбрасывает
              время.
            </li>
            <li>
              Выбранный ответ нужно подтвердить кнопкой «Отправить ответ». После подтверждения изменить его нельзя.
            </li>
            <li>При истечении времени подтверждённые ответы учитываются, оставшиеся вопросы считаются неверными.</li>
            <li>
              Каждая новая попытка расходует одну из доступных попыток. Продолжение начатой попытки не расходует
              дополнительную.
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void state.loadAttempt()}>Начать или продолжить аттестацию</Button>
            <Button variant="outline" onClick={state.handleExit}>
              К списку
            </Button>
          </div>
        </Card>
      )}
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Выйти из теста?"
        description="Выход не завершает попытку. Подтверждённые ответы сохранены. Неподтверждённый ответ не учитывается; его черновик доступен только в этом браузере. Если установлен таймер, он продолжит идти."
        cancelText="Остаться в тесте"
        confirmText="Выйти"
        onCancel={() => {
          if (blocker.state === "blocked") blocker.reset();
        }}
        onConfirm={() => {
          if (blocker.state === "blocked") blocker.proceed();
        }}
      />

      {state.attempt && !state.loading && (
        <ExamRunLayout
          attempt={state.attempt}
          currentIndex={state.currentIndex}
          remainingSec={state.remainingSec}
          formatRemainingTime={state.formatRemainingTime}
          questionError={state.questionError}
          timeExpired={state.timeExpired}
          result={state.result}
          isCurrentQuestionConfirmed={state.isCurrentQuestionConfirmed}
          submitting={state.submitting || state.savingAnswer}
          onConfirm={state.confirmCurrentAnswer}
          onNext={state.goToNext}
          onExit={state.handleExit}
          onRestart={state.isCertificationExam ? undefined : state.loadAttempt}
          onFinish={() => navigate(state.resultRoute ?? state.backRoute)}
          disableConfirm={Boolean(state.currentQuestionError)}
          questionContent={
            state.currentQuestion ? (
              <div className="space-y-3">
                <QuestionRenderer
                  question={state.currentQuestion}
                  index={state.currentIndex}
                  selected={state.answers[state.currentQuestion.questionId]}
                  isConfirmed={
                    state.isCurrentQuestionConfirmed || state.savingAnswer || state.timeExpired || state.submitting
                  }
                  explanation={state.renderQuestionExplanation(state.currentQuestion)}
                  onSingleChange={(value) => state.setSingleAnswer(state.currentQuestion!, value)}
                  onMultiChange={(value, checked) => state.setMultiAnswer(state.currentQuestion!, value, checked)}
                  onMatchChange={(left, right) => state.setMatchRight(state.currentQuestion!, left, right)}
                  onFillSelectChange={(blankIndex, value) =>
                    state.setFillSelectAnswer(state.currentQuestion!, blankIndex, value)
                  }
                />
              </div>
            ) : null
          }
        />
      )}
    </div>
  );
}

import { useNavigate, useParams } from "react-router-dom";
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
  const navigate = useNavigate();
  const { restaurantId } = useTrainingAccess();
  const state = useExamRunState({
    restaurantId: restaurantId ?? undefined,
    examId: parsedExamId,
    folderId: Number.isFinite(parsedFolderId) ? parsedFolderId : null,
    navigate,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={state.breadcrumbItems} />
      <h2 className="text-2xl font-semibold text-default">Прохождение теста</h2>

      {state.loading && <LoadingState label="Запускаем тест…" />}
      {state.error && <ErrorState message={state.error} onRetry={state.loadAttempt} />}

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
          submitting={state.submitting}
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
                  isConfirmed={state.isCurrentQuestionConfirmed}
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

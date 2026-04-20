import { useMemo, useState } from "react";
import Card from "../../../../shared/ui/Card";
import { renderAnswer } from "../../utils/certificationResultFormatting";

type ReviewQuestion = {
  questionId: number;
  prompt: string;
  chosenAnswerJson?: string | null;
  correct: boolean;
  correctAnswerJson?: string | null;
  explanation?: string | null;
};

type Props = {
  questions: ReviewQuestion[];
  revealCorrectAnswers: boolean;
  hiddenCorrectAnswersHint?: string;
};

export default function CertificationQuestionReviewSection({ questions, revealCorrectAnswers, hiddenCorrectAnswersHint }: Props) {
  const [onlyWrong, setOnlyWrong] = useState(false);

  const preparedQuestions = useMemo(
    () => questions.map((question, index) => ({ ...question, displayIndex: index + 1 })),
    [questions],
  );

  const visibleQuestions = useMemo(() => (
    onlyWrong ? preparedQuestions.filter((question) => !question.correct) : preparedQuestions
  ), [onlyWrong, preparedQuestions]);

  if (questions.length === 0) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-default">Разбор вопросов</div>
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyWrong} onChange={(event) => setOnlyWrong(event.target.checked)} />
          Показать только ошибки
        </label>
      </div>
      {!revealCorrectAnswers && hiddenCorrectAnswersHint && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {hiddenCorrectAnswersHint}
        </div>
      )}
      <div className="space-y-3">
        {visibleQuestions.map((question) => (
          <div key={`${question.questionId}-${question.displayIndex}`} className={`rounded-xl border p-3 ${question.correct ? "border-emerald-200" : "border-rose-200 bg-rose-50/40"}`}>
            <div className="text-sm font-medium">#{question.displayIndex}. {question.prompt}</div>
            <div className="mt-1 text-sm text-muted">Ваш ответ: {renderAnswer(question.chosenAnswerJson)}</div>
            {revealCorrectAnswers && (
              <div className="mt-1 text-sm text-muted">Правильный ответ: {renderAnswer(question.correctAnswerJson, "—")}</div>
            )}
            <div className={`mt-1 text-sm ${question.correct ? "text-emerald-700" : "text-rose-700"}`}>{question.correct ? "Верно" : "Ошибка"}</div>
            {question.explanation && <div className="mt-2 text-sm text-muted">Пояснение: {question.explanation}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

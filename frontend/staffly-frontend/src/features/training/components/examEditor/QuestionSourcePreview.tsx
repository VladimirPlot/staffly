import type { TrainingQuestionDto } from "../../api/types";
import { QUESTION_TYPE_LABELS } from "../../utils/questionLabels";

export default function QuestionSourcePreview({ question }: { question: TrainingQuestionDto }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">{QUESTION_TYPE_LABELS[question.type]}</p>
      <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{question.prompt}</p>
      {question.options?.length > 0 && (
        <ul className="space-y-2">
          {[...question.options]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((option, index) => (
              <li key={option.id ?? index} className="border-subtle rounded-xl border p-2 [overflow-wrap:anywhere]">
                {option.text}
                {option.correct && <span className="ml-2 font-medium">✓ Верный ответ</span>}
              </li>
            ))}
        </ul>
      )}
      {question.type === "MATCH" && (
        <div className="space-y-2">
          <p className="font-medium">Правильные пары</p>
          {question.matchPairs?.map((pair, index) => (
            <p key={pair.id ?? index} className="[overflow-wrap:anywhere] whitespace-pre-wrap">
              {pair.leftText} → {pair.rightText}
            </p>
          ))}
        </div>
      )}
      {question.type === "FILL_SELECT" &&
        question.blanks?.map((blank) => (
          <div key={blank.index} className="space-y-2">
            <p className="font-medium">Пропуск {blank.index}</p>
            <ul className="space-y-1">
              {blank.options.map((option, index) => (
                <li key={option.id ?? index} className="[overflow-wrap:anywhere]">
                  {option.text}
                  {option.correct && <span className="ml-2 font-medium">✓ Верный ответ</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      {question.explanation && (
        <div>
          <p className="font-medium">Пояснение</p>
          <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}

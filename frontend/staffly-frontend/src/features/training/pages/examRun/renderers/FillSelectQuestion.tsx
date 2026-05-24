import type { ChangeEvent } from "react";
import type { AttemptQuestionSnapshotDto } from "../../../api/types";
import DropdownSelect from "../../../../../shared/ui/DropdownSelect";
import { parseFillBlankAnswer } from "../answerUtils";
import { renderInlineFillPrompt } from "../fillSelect";
import QuestionFrame from "./QuestionFrame";

type Props = {
  question: AttemptQuestionSnapshotDto;
  index: number;
  selected?: string;
  isConfirmed: boolean;
  explanation: import("react").ReactNode;
  onChange: (blankIndex: number, value: string) => void;
};

export default function FillSelectQuestion({
  question,
  index,
  selected,
  isConfirmed,
  explanation,
  onChange,
}: Props) {
  const current = parseFillBlankAnswer(selected);
  const byIndex = new Map(current.map((item) => [item.blankIndex, item.value]));
  const hasTemplateTokens = /\{\{\d+\}\}/.test(question.prompt);

  return (
    <div className="rounded-2xl border border-subtle bg-app p-3">
      {hasTemplateTokens ? (
        renderInlineFillPrompt(question, byIndex, isConfirmed, onChange)
      ) : (
        <QuestionFrame index={index} prompt={question.prompt} explanation={explanation}>
          <div className="mt-3 space-y-3">
            {[...question.blanks]
              .sort((a, b) => a.blankIndex - b.blankIndex)
              .map((blank) => (
                <div key={blank.blankIndex}>
                  <div className="mb-1 text-sm text-muted">Пропуск {blank.blankIndex}</div>
                  <DropdownSelect
                    aria-label={`Пропуск ${blank.blankIndex}`}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    value={byIndex.get(blank.blankIndex) ?? ""}
                    disabled={isConfirmed}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(blank.blankIndex, event.target.value)}
                  >
                    <option value="" disabled>
                      Выберите вариант
                    </option>
                    {blank.options.map((option) => (
                      <option key={option.text} value={option.text}>{option.text}</option>
                    ))}
                  </DropdownSelect>
                </div>
              ))}
          </div>
        </QuestionFrame>
      )}
      {hasTemplateTokens && explanation}
    </div>
  );
}

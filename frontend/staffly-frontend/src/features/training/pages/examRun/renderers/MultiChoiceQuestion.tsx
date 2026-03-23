import type { AttemptQuestionSnapshotDto } from "../../../api/types";
import { parseStringArrayAnswer } from "../answerUtils";
import QuestionFrame from "./QuestionFrame";

type Props = {
  question: AttemptQuestionSnapshotDto;
  index: number;
  selected?: string;
  isConfirmed: boolean;
  explanation: import("react").ReactNode;
  onChange: (value: string, checked: boolean) => void;
};

export default function MultiChoiceQuestion({
  question,
  index,
  selected,
  isConfirmed,
  explanation,
  onChange,
}: Props) {
  const selectedValues = new Set(parseStringArrayAnswer(selected));
  const options = [...question.options].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <QuestionFrame index={index} prompt={question.prompt} explanation={explanation}>
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.text} className="flex items-center gap-2 text-sm text-default">
            <input
              type="checkbox"
              checked={selectedValues.has(option.text)}
              disabled={isConfirmed}
              onChange={(event) => onChange(option.text, event.target.checked)}
            />
            {option.text}
          </label>
        ))}
      </div>
    </QuestionFrame>
  );
}

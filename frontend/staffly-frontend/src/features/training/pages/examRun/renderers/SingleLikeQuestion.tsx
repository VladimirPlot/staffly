import type { AttemptQuestionSnapshotDto } from "../../../api/types";
import { parseStringAnswer } from "../answerUtils";
import QuestionFrame from "./QuestionFrame";

type Props = {
  question: AttemptQuestionSnapshotDto;
  index: number;
  selected?: string;
  isConfirmed: boolean;
  explanation: import("react").ReactNode;
  onChange: (value: string) => void;
};

export default function SingleLikeQuestion({
  question,
  index,
  selected,
  isConfirmed,
  explanation,
  onChange,
}: Props) {
  const current = parseStringAnswer(selected);
  const options = [...question.options].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <QuestionFrame index={index} prompt={question.prompt} explanation={explanation}>
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.text} className="flex items-center gap-2 text-sm text-default">
            <input
              type="radio"
              name={`q-${question.questionId}`}
              checked={current === option.text}
              disabled={isConfirmed}
              onChange={() => onChange(option.text)}
            />
            {option.text}
          </label>
        ))}
      </div>
    </QuestionFrame>
  );
}

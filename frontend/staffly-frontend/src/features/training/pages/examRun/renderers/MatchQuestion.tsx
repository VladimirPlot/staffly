import type { AttemptQuestionSnapshotDto } from "../../../api/types";
import DropdownSelect from "../../../../../shared/ui/DropdownSelect";
import { parseMatchAnswer } from "../answerUtils";
import QuestionFrame from "./QuestionFrame";

type Props = {
  question: AttemptQuestionSnapshotDto;
  index: number;
  selected?: string;
  isConfirmed: boolean;
  explanation: import("react").ReactNode;
  onChange: (left: string, right: string) => void;
};

export default function MatchQuestion({
  question,
  index,
  selected,
  isConfirmed,
  explanation,
  onChange,
}: Props) {
  const pairs = [...question.matchPairs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const rights = Array.from(new Set(pairs.map((pair) => pair.rightText))).sort((a, b) => a.localeCompare(b, "ru"));
  const payload = parseMatchAnswer(selected, question);
  const rightByLeft = new Map(payload.map((pair) => [pair.left, pair.right]));
  const used = new Set(payload.map((pair) => pair.right).filter(Boolean));

  const optionsFor = (currentValue: string) => rights.filter((right) => right === currentValue || !used.has(right));

  return (
    <QuestionFrame index={index} prompt={question.prompt} explanation={explanation}>
      <div className="mt-3 space-y-2">
        {pairs.map((pair) => {
          const value = rightByLeft.get(pair.leftText) ?? "";
          return (
            <div
              key={pair.leftText}
              className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,11rem)] sm:items-center sm:gap-3"
            >
              <div className="min-w-0 text-sm text-default">{pair.leftText}</div>
              <div className="min-w-0">
                <DropdownSelect
                  aria-label={pair.leftText}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ minHeight: 44 }}
                  value={value}
                  disabled={isConfirmed}
                  onChange={(event) => onChange(pair.leftText, event.target.value)}
                >
                  <option value="" disabled hidden />
                  {optionsFor(value).map((right) => (
                    <option key={right} value={right}>
                      {right}
                    </option>
                  ))}
                </DropdownSelect>
              </div>
            </div>
          );
        })}
      </div>
    </QuestionFrame>
  );
}

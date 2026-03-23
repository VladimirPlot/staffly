import type { AttemptQuestionSnapshotDto } from "../../../api/types";
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
            <div key={pair.leftText} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-default">{pair.leftText}</div>
              <select
                className="w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-sm text-default sm:max-w-xs"
                value={value}
                disabled={isConfirmed}
                onChange={(event) => onChange(pair.leftText, event.target.value)}
              >
                <option value="" disabled hidden />
                {optionsFor(value).map((right) => (
                  <option key={right} value={right}>{right}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </QuestionFrame>
  );
}

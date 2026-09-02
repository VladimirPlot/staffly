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
  const leftItems = [...question.matchLeftItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const rights = question.matchRightOptions.map((option) => option.text);
  const payload = parseMatchAnswer(selected, question);
  const rightByLeft = new Map(payload.map((pair) => [pair.left, pair.right]));
  const used = new Set(payload.map((pair) => pair.right).filter(Boolean));

  const optionsFor = (currentValue: string) => rights.filter((right) => right === currentValue || !used.has(right));

  return (
    <QuestionFrame index={index} prompt={question.prompt} explanation={explanation}>
      <div className="mt-3 space-y-2">
        {leftItems.map((item, pairIndex) => {
          const value = rightByLeft.get(item.text) ?? "";
          return (
            <div
              key={item.text}
              className="grid grid-cols-[minmax(0,1fr)_8rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center sm:gap-3"
            >
              <div className="min-w-0 text-sm leading-5 text-default break-words text-pretty">{item.text}</div>
              <div className="min-w-0">
                <DropdownSelect
                  aria-label={`${pairIndex + 1}. ${item.text}`}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  matchTriggerWidth={false}
                  menuClassName="w-[min(16rem,calc(100vw-1rem))] sm:w-72"
                  value={value}
                  disabled={isConfirmed}
                  onChange={(event) => onChange(item.text, event.target.value)}
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

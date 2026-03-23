import ChoiceIndicator from "../shared/ChoiceIndicator";
import type { QuestionOptionDraft } from "../shared/questionEditorTypes";

type Props = {
  options: QuestionOptionDraft[];
  onChange: (value: QuestionOptionDraft[]) => void;
};

const TRUE_FALSE_OPTIONS = [
  { label: "Правда", index: 0 },
  { label: "Ложь", index: 1 },
] as const;

export default function TrueFalseEditor({ options, onChange }: Props) {
  const selectOption = (index: number) => {
    onChange([
      { text: "Правда", correct: index === 0 },
      { text: "Ложь", correct: index === 1 },
    ]);
  };

  return (
    <div className="space-y-3">
      <p className="text-muted text-sm [overflow-wrap:anywhere]">Выберите один правильный вариант ответа.</p>

      <div className="space-y-3">
        {TRUE_FALSE_OPTIONS.map(({ label, index }, rowIndex) => {
          const checked = options[index]?.correct ?? false;

          return (
            <div
              key={label}
              className={[
                "flex min-w-0 items-center gap-3",
                rowIndex > 0 ? "border-subtle border-t pt-3" : "",
              ].join(" ")}
            >
              <ChoiceIndicator
                checked={checked}
                ariaLabel={`Выбрать вариант: ${label}`}
                onClick={() => selectOption(index)}
              />

              <button
                type="button"
                className="text-left text-lg font-medium text-default transition hover:opacity-80"
                onClick={() => selectOption(index)}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

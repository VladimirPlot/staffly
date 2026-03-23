import Button from "../../../../../shared/ui/Button";
import type { QuestionOptionDraft } from "../shared/questionEditorTypes";
import QuestionOptionRow from "../shared/QuestionOptionRow";

type Props = {
  options: QuestionOptionDraft[];
  duplicates: Set<string>;
  onOptionsChange: (updater: (prev: QuestionOptionDraft[]) => QuestionOptionDraft[]) => void;
};

export default function MultiChoiceEditor({ options, duplicates, onOptionsChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-muted text-sm [overflow-wrap:anywhere]">
        Отметьте все верные варианты. Можно выбрать несколько правильных ответов.
      </p>

      <div className="space-y-3">
        {options.map((option, index) => (
          <QuestionOptionRow
            key={index}
            index={index}
            label={`Вариант ${index + 1}`}
            value={option.text}
            checked={option.correct}
            toggleAriaLabel={`Переключить правильность варианта ${index + 1}`}
            onToggle={() =>
              onOptionsChange((prev) =>
                prev.map((item, idx) =>
                  idx === index ? { ...item, correct: !item.correct } : item,
                ),
              )
            }
            onChange={(value) =>
              onOptionsChange((prev) =>
                prev.map((item, idx) => (idx === index ? { ...item, text: value } : item)),
              )
            }
            onRemove={() => onOptionsChange((prev) => prev.filter((_, idx) => idx !== index))}
            removeDisabled={options.length <= 2}
            error={duplicates.has(`option-${index}`) ? "Дубликат" : undefined}
          />
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => onOptionsChange((prev) => [...prev, { text: "", correct: false }])}
      >
        Добавить вариант
      </Button>
    </div>
  );
}

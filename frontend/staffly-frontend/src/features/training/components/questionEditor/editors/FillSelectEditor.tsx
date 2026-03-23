import { Trash2 } from "lucide-react";
import type { TrainingQuestionBlankDto } from "../../../api/types";
import Button from "../../../../../shared/ui/Button";
import IconButton from "../../../../../shared/ui/IconButton";
import QuestionOptionRow from "../shared/QuestionOptionRow";

type Props = {
  blanks: TrainingQuestionBlankDto[];
  duplicates: Set<string>;
  onBlanksChange: (updater: (prev: TrainingQuestionBlankDto[]) => TrainingQuestionBlankDto[]) => void;
  onRemoveBlank: (index: number) => void;
};

export default function FillSelectEditor({ blanks, duplicates, onBlanksChange, onRemoveBlank }: Props) {
  return (
    <div className="space-y-3">
      {blanks.length === 0 && (
        <p className="text-muted text-sm [overflow-wrap:anywhere]">
          Добавьте пропуск в формулировку, и здесь появятся варианты ответа для него.
        </p>
      )}

      {blanks.map((blank) => (
        <div key={blank.index} className="border-subtle space-y-3 rounded-2xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium [overflow-wrap:anywhere]">Пропуск {blank.index}</div>
            <IconButton onClick={() => onRemoveBlank(blank.index)}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>

          <div className="space-y-3">
            {blank.options.map((option, index) => (
              <QuestionOptionRow
                key={index}
                index={index}
                label={`Вариант ${index + 1}`}
                value={option.text}
                checked={option.correct}
                toggleAriaLabel={`Сделать вариант ${index + 1} верным для пропуска ${blank.index}`}
                onToggle={() =>
                  onBlanksChange((prev) =>
                    prev.map((item) =>
                      item.index === blank.index
                        ? {
                            ...item,
                            options: item.options.map((candidate, candidateIndex) => ({
                              ...candidate,
                              correct: candidateIndex === index,
                            })),
                          }
                        : item,
                    ),
                  )
                }
                onChange={(value) =>
                  onBlanksChange((prev) =>
                    prev.map((item) =>
                      item.index === blank.index
                        ? {
                            ...item,
                            options: item.options.map((candidate, candidateIndex) =>
                              candidateIndex === index ? { ...candidate, text: value } : candidate,
                            ),
                          }
                        : item,
                    ),
                  )
                }
                onRemove={() =>
                  onBlanksChange((prev) =>
                    prev.map((item) =>
                      item.index === blank.index
                        ? {
                            ...item,
                            options: item.options
                              .filter((_, candidateIndex) => candidateIndex !== index)
                              .map((candidate, candidateIndex) => ({
                                ...candidate,
                                correct: candidateIndex === 0 ? candidate.correct || index === 0 : candidate.correct,
                                sortOrder: candidateIndex,
                              })),
                          }
                        : item,
                    ),
                  )
                }
                error={duplicates.has(`blank-${blank.index}-${index}`) ? "Дубликат" : undefined}
              />
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              onBlanksChange((prev) =>
                prev.map((item) =>
                  item.index === blank.index
                    ? {
                        ...item,
                        options: [
                          ...item.options,
                          { text: "", correct: false, sortOrder: item.options.length },
                        ],
                      }
                    : item,
                ),
              )
            }
          >
            Добавить вариант
          </Button>
        </div>
      ))}
    </div>
  );
}

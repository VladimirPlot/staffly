import { useId } from "react";
import Button from "../../../../shared/ui/Button";
import Input from "../../../../shared/ui/Input";
import Textarea from "../../../../shared/ui/Textarea";
import type { TrainingQuestionType } from "../../api/types";

type Props = {
  type: TrainingQuestionType;
  title: string;
  prompt: string;
  explanation: string;
  onTitleChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onExplanationChange: (value: string) => void;
  onPromptSelectionChange: (selection: { start: number; end: number }) => void;
  onAddBlank: () => void;
};

export default function QuestionEditorCommonFields({
  type,
  title,
  prompt,
  explanation,
  onTitleChange,
  onPromptChange,
  onExplanationChange,
  onPromptSelectionChange,
  onAddBlank,
}: Props) {
  const promptTextareaId = useId();

  const updatePromptSelectionFromElement = (element: HTMLTextAreaElement) => {
    onPromptSelectionChange({
      start: element.selectionStart ?? 0,
      end: element.selectionEnd ?? 0,
    });
  };

  return (
    <>
      <Input label="Название" value={title} onChange={(e) => onTitleChange(e.target.value)} required />

      <div className="space-y-2">
        <Textarea
          id={promptTextareaId}
          label="Формулировка"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onSelect={(e) => updatePromptSelectionFromElement(e.currentTarget)}
          onClick={(e) => updatePromptSelectionFromElement(e.currentTarget)}
          onKeyUp={(e) => updatePromptSelectionFromElement(e.currentTarget)}
          required
        />

        {type === "FILL_SELECT" && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onAddBlank}>
              Добавить пропуск
            </Button>
          </div>
        )}
      </div>

      <Textarea
        label="Пояснение"
        hint="Показывается пользователю после ответа и объясняет правильный вариант. Оставьте поле пустым, если пояснение не требуется."
        value={explanation}
        onChange={(e) => onExplanationChange(e.target.value)}
      />
    </>
  );
}

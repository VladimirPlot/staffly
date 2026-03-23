import SelectField from "../../../../shared/ui/SelectField";
import type { TrainingQuestionType } from "../../api/types";
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER } from "../../utils/questionLabels";

type Props = {
  value: TrainingQuestionType;
  onChange: (value: TrainingQuestionType) => void;
};

export default function QuestionEditorStepType({ value, onChange }: Props) {
  return (
    <SelectField label="Тип" value={value} onChange={(e) => onChange(e.target.value as TrainingQuestionType)}>
      {QUESTION_TYPE_ORDER.map((questionType) => (
        <option key={questionType} value={questionType}>
          {QUESTION_TYPE_LABELS[questionType]}
        </option>
      ))}
    </SelectField>
  );
}

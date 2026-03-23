import Button from "../../../../shared/ui/Button";
import type { TrainingQuestionGroup } from "../../api/types";
import { QUESTION_GROUP_LABELS } from "../../utils/questionLabels";

type Props = {
  value: TrainingQuestionGroup;
  onChange: (value: TrainingQuestionGroup) => void;
};

export default function QuestionEditorStepUsage({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Button
        variant={value === "PRACTICE" ? "primary" : "outline"}
        className="w-full"
        onClick={() => onChange("PRACTICE")}
      >
        {QUESTION_GROUP_LABELS.PRACTICE} вопрос
      </Button>
      <Button
        variant={value === "CERTIFICATION" ? "primary" : "outline"}
        className="w-full"
        onClick={() => onChange("CERTIFICATION")}
      >
        {QUESTION_GROUP_LABELS.CERTIFICATION} вопрос
      </Button>
    </div>
  );
}

import Card from "../../../../shared/ui/Card";
import type { TrainingExamDto } from "../../api/types";
import CertificationExamListItem from "./CertificationExamListItem";

type Props = {
  exams: TrainingExamDto[];
  selectedExamId: number | null;
  canManage: boolean;
  loadingExamActionId: number | null;
  onSelectExam: (examId: number) => void;
  onExamAction: (examId: number, action: "hide" | "restore" | "delete") => void;
};

export default function CertificationExamSidebar({
  exams,
  selectedExamId,
  canManage,
  loadingExamActionId,
  onSelectExam,
  onExamAction,
}: Props) {
  return (
    <Card className="space-y-2 h-fit">
      <div className="text-sm font-semibold">Список аттестаций</div>
      {exams.map((exam) => (
        <CertificationExamListItem
          key={exam.id}
          exam={exam}
          selected={selectedExamId === exam.id}
          canManage={canManage}
          loading={loadingExamActionId === exam.id}
          onSelect={onSelectExam}
          onAction={onExamAction}
        />
      ))}
    </Card>
  );
}

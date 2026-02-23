import Card from "../../../shared/ui/Card";
import type { ExamProgressDto, TrainingExamDto } from "../api/types";
import ExamRow from "./ExamRow";

type Props = {
  exams: TrainingExamDto[];
  canManage: boolean;
  progressByExamId: Map<number, ExamProgressDto>;
  actionLoadingId: number | null;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  onReset: (id: number) => void;
};

export default function ExamList({
  exams,
  canManage,
  progressByExamId,
  actionLoadingId,
  onHide,
  onRestore,
  onDelete,
  onReset,
}: Props) {
  return (
    <Card className="space-y-3">
      {exams.map((exam) => (
        <ExamRow
          key={exam.id}
          exam={exam}
          canManage={canManage}
          progress={progressByExamId.get(exam.id)}
          isBusy={actionLoadingId === exam.id}
          onHide={onHide}
          onRestore={onRestore}
          onDelete={onDelete}
          onReset={onReset}
        />
      ))}
    </Card>
  );
}

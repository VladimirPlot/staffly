import Card from "../../../../shared/ui/Card";
import ErrorState from "../../components/ErrorState";
import LoadingState from "../../components/LoadingState";
import ExamRow from "../../components/ExamRow";
import type { ExamProgressDto, TrainingExamDto } from "../../api/types";
import { getPracticeExamStatus } from "../../utils/practiceExamStatus";
import { trainingRoutes } from "../../utils/trainingRoutes";

type Props = {
  examsLoading: boolean;
  examsError: string | null;
  practiceExams: TrainingExamDto[];
  canManage: boolean;
  examActionLoadingId: number | null;
  progressByExamId: Map<number, ExamProgressDto>;
  inProgressExamIds: Set<number>;
  currentFolderId: number | null;
  onRetry: () => void;
  onEdit: (exam: TrainingExamDto) => void;
  onExamAction: (examId: number, action: "hide" | "restore" | "delete") => void;
};

export default function KnowledgePracticeExamsSection({
  examsLoading,
  examsError,
  practiceExams,
  canManage,
  examActionLoadingId,
  progressByExamId,
  inProgressExamIds,
  currentFolderId,
  onRetry,
  onEdit,
  onExamAction,
}: Props) {
  if (!examsLoading && !examsError && practiceExams.length === 0) return null;

  return (
    <Card className="space-y-3">
      <h3 className="text-lg font-semibold">Практические тесты</h3>

      {examsLoading && <LoadingState label="Загрузка тестов…" />}
      {examsError && <ErrorState message={examsError} onRetry={onRetry} />}

      {!examsLoading && !examsError && practiceExams.length > 0 && (
        <div className="space-y-3">
          {practiceExams.map((exam) => (
            <ExamRow
              key={exam.id}
              exam={exam}
              canManage={canManage}
              isBusy={examActionLoadingId === exam.id}
              practiceStatus={getPracticeExamStatus(exam.id, progressByExamId.get(exam.id), inProgressExamIds)}
              progress={progressByExamId.get(exam.id)}
              onEdit={onEdit}
              onHide={(id) => onExamAction(id, "hide")}
              onRestore={(id) => onExamAction(id, "restore")}
              onDelete={(id) => onExamAction(id, "delete")}
              runRoute={currentFolderId == null ? null : trainingRoutes.knowledgeExamRun(currentFolderId, exam.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

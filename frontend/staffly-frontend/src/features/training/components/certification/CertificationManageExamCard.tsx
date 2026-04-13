import { Eye, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import IconButton from "../../../../shared/ui/IconButton";
import type { PositionDto } from "../../../dictionaries/api";
import type { TrainingExamDto } from "../../api/types";
import { trainingRoutes } from "../../utils/trainingRoutes";

type Props = {
  exam: TrainingExamDto;
  loading: boolean;
  positionsById: Map<number, PositionDto>;
  onEdit: (exam: TrainingExamDto) => void;
  onAction: (examId: number, action: "hide" | "restore" | "delete") => void;
};

export default function CertificationManageExamCard({ exam, loading, positionsById, onEdit, onAction }: Props) {
  const targets = exam.visibilityPositionIds
    .map((id) => positionsById.get(id)?.name)
    .filter((item): item is string => Boolean(item));

  return (
    <div className="rounded-xl border border-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-default">{exam.title}</div>
          <div className="mt-1 text-xs text-muted">
            {targets.length > 0 ? `Должности: ${targets.join(", ")}` : "Должности не заданы"}
          </div>
          <div className="mt-1 text-xs text-muted">Вопросов: {exam.questionCount} · Проходной: {exam.passPercent}%</div>
        </div>

        <div className="flex items-center gap-1">
          <Link to={trainingRoutes.examAnalytics(exam.id)} className="rounded-xl border border-subtle px-3 py-1.5 text-xs font-medium hover:bg-app">
            Открыть
          </Link>
          <IconButton aria-label="Редактировать аттестацию" title="Редактировать" disabled={loading} onClick={() => onEdit(exam)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton
            aria-label={exam.active ? "Скрыть аттестацию" : "Восстановить аттестацию"}
            title={exam.active ? "Скрыть" : "Восстановить"}
            disabled={loading}
            onClick={() => onAction(exam.id, exam.active ? "hide" : "restore")}
          >
            <Eye className="h-4 w-4" />
          </IconButton>
          <IconButton aria-label="Удалить аттестацию" title="Удалить" disabled={loading} onClick={() => onAction(exam.id, "delete")}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

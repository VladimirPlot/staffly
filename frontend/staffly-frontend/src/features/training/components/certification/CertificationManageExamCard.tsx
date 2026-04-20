import { Eye, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import IconButton from "../../../../shared/ui/IconButton";
import type { PositionDto } from "../../../dictionaries/api";
import type { TrainingExamDto } from "../../api/types";
import CertificationCompletionProgress from "./CertificationCompletionProgress";

type Props = {
  exam: TrainingExamDto;
  analyticsHref: string;
  loading: boolean;
  positionsById: Map<number, PositionDto>;
  onEdit: (exam: TrainingExamDto) => void;
  onAction: (examId: number, action: "hide" | "restore" | "delete") => void;
};

export default function CertificationManageExamCard({
  exam,
  analyticsHref,
  loading,
  positionsById,
  onEdit,
  onAction,
}: Props) {
  const targets = exam.visibilityPositionIds
    .map((id) => positionsById.get(id)?.name)
    .filter((item): item is string => Boolean(item));
  const summary = exam.certificationSummaryPreview;
  const assigned = summary?.totalAssigned ?? 0;
  const passed = summary?.passedCount ?? 0;
  const failed = summary?.failedCount ?? 0;
  const completed = summary?.completedCount ?? passed + failed;

  return (
    <div className="rounded-xl border border-subtle p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-default">{exam.title}</div>
            <span className="shrink-0 rounded-full border border-subtle px-2 py-0.5 text-[11px] text-muted">
              {exam.active ? "Активна" : "Скрыта"}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted">
            {targets.length > 0 ? `Должности: ${targets.join(", ")}` : "Должности не заданы"}
          </div>
          <div className="mt-1 text-xs text-muted">Вопросов: {exam.questionCount} · Проходной: {exam.passPercent}%</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
            <div className="rounded-lg bg-app px-2 py-1">Назначено: {assigned}</div>
            <div className="rounded-lg bg-app px-2 py-1">Завершили: {completed}</div>
            <div className="rounded-lg bg-app px-2 py-1">Сдали: {passed}</div>
            <div className="rounded-lg bg-app px-2 py-1">Не сдали: {failed}</div>
          </div>
        </div>

        <div className="flex flex-row items-center justify-between gap-3 md:flex-col md:items-end">
          <CertificationCompletionProgress completed={completed} assigned={assigned} />
          <div className="flex items-center gap-1">
            <Link to={analyticsHref} className="rounded-xl border border-subtle px-3 py-1.5 text-xs font-medium hover:bg-app">
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
    </div>
  );
}

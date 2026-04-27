import { Eye, Pencil, Trash2, UserRoundCog } from "lucide-react";
import { Link } from "react-router-dom";
import IconButton from "../../../../shared/ui/IconButton";
import type { PositionDto } from "../../../dictionaries/api";
import type { TrainingExamDto } from "../../api/types";
import CertificationCompletionProgress from "./CertificationCompletionProgress";
import CertificationResultMetrics from "./CertificationResultMetrics";

type Props = {
  exam: TrainingExamDto;
  analyticsHref: string;
  loading: boolean;
  positionsById: Map<number, PositionDto>;
  onEdit: (exam: TrainingExamDto) => void;
  onChangeOwner: (exam: TrainingExamDto) => void;
  onAction: (examId: number, action: "hide" | "restore" | "delete") => void;
};

export default function CertificationManageExamCard({
  exam,
  analyticsHref,
  loading,
  positionsById,
  onEdit,
  onChangeOwner,
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
  const ownerLabel = exam.ownerFullName?.trim() ? `Ответственный: ${exam.ownerFullName}` : "Ответственный не назначен";

  return (
    <div className="group relative rounded-2xl border border-subtle bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--staffly-border)] hover:shadow-md sm:p-5">
      <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1">
          <IconButton
            aria-label="Редактировать аттестацию"
            title="Редактировать"
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEdit(exam);
            }}
          >
            <Pencil className="h-4 w-4" />
          </IconButton>

          <IconButton
            aria-label={exam.active ? "Скрыть аттестацию" : "Восстановить аттестацию"}
            title={exam.active ? "Скрыть" : "Восстановить"}
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAction(exam.id, exam.active ? "hide" : "restore");
            }}
          >
            <Eye className="h-4 w-4" />
          </IconButton>

          <IconButton
            aria-label="Удалить аттестацию"
            title="Удалить"
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAction(exam.id, "delete");
            }}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>

        <CertificationResultMetrics
          passedCount={passed}
          failedCount={failed}
          preset="md"
        />
      </div>

      <Link
        to={analyticsHref}
        className="block cursor-pointer rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--staffly-border)]"
      >
        <div className="pr-40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-default break-words transition-colors duration-200 group-hover:text-strong sm:text-lg">
                  {exam.title}
                </h4>

                <span className="shrink-0 rounded-full border border-subtle px-3 py-0.5 text-xs text-muted">
                  {exam.active ? "Активна" : "Скрыта"}
                </span>
              </div>

              <div className="mt-2 text-sm text-muted break-words">
                {targets.length > 0
                  ? `Должности: ${targets.join(", ")}`
                  : "Должности не заданы"}
              </div>

              <div className="mt-1 text-sm text-muted">
                Вопросов: {exam.questionCount} · Проходной: {exam.passPercent}%
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:gap-4">
              <CertificationCompletionProgress
                completed={completed}
                assigned={assigned}
                size={104}
                preset="lg"
              />
            </div>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-muted">{ownerLabel}</div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-subtle px-2 py-1 text-xs text-muted transition-colors hover:bg-white/70 hover:text-default disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onChangeOwner(exam);
          }}
        >
          <UserRoundCog className="h-3.5 w-3.5" />
          Сменить ответственного
        </button>
      </div>
    </div>
  );
}

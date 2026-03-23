import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import type { ExamProgressDto, TrainingExamDto } from "../api/types";
import { trainingRoutes } from "../utils/trainingRoutes";
import ExamProgressBadge from "./ExamProgressBadge";

type Props = {
  exam: TrainingExamDto;
  canManage: boolean;
  progress?: ExamProgressDto;
  isBusy: boolean;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  onReset: (id: number) => void;
  onEdit?: (exam: TrainingExamDto) => void;
};

export default function ExamRow({
  exam,
  canManage,
  progress,
  isBusy,
  onHide,
  onRestore,
  onDelete,
  onReset,
  onEdit,
}: Props) {
  return (
    <div className="rounded-2xl border border-subtle bg-app p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-default">{exam.title}</div>

            <ExamProgressBadge progress={progress} />

            {!exam.active && (
              <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                Скрыт
              </span>
            )}
          </div>

          {exam.description && (
            <div className="text-sm text-muted">{exam.description}</div>
          )}

          <div className="text-sm text-muted">
            Вопросов: {exam.questionCount} · Проходной балл: {exam.passPercent}%
            {typeof progress?.scorePercent === "number"
              ? ` · Последний результат: ${progress.scorePercent}%`
              : ""}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
          {canManage && (
            <>
              {onEdit && (
                <IconButton
                  aria-label="Редактировать аттестацию"
                  title="Редактировать"
                  onClick={() => onEdit(exam)}
                  disabled={isBusy}
                >
                  <Icon icon={Pencil} size="sm" />
                </IconButton>
              )}

              <IconButton
                aria-label="Сбросить результаты"
                title="Сбросить результаты"
                onClick={() => onReset(exam.id)}
                disabled={isBusy}
              >
                <Icon icon={Trash2} size="sm" />
              </IconButton>

              {exam.active ? (
                <IconButton
                  aria-label="Скрыть аттестацию"
                  title="Скрыть"
                  onClick={() => onHide(exam.id)}
                  disabled={isBusy}
                >
                  <Icon icon={EyeOff} size="sm" />
                </IconButton>
              ) : (
                <IconButton
                  aria-label="Восстановить аттестацию"
                  title="Восстановить"
                  onClick={() => onRestore(exam.id)}
                  disabled={isBusy}
                >
                  <Icon icon={Eye} size="sm" />
                </IconButton>
              )}

              <IconButton
                aria-label={exam.active ? "Скрыть аттестацию" : "Удалить аттестацию навсегда"}
                title={exam.active ? "Скрыть" : "Удалить навсегда"}
                onClick={() => (exam.active ? onHide(exam.id) : onDelete(exam.id))}
                disabled={isBusy}
              >
                <Icon icon={Trash2} size="sm" />
              </IconButton>
            </>
          )}

          <Link to={trainingRoutes.examRun(exam.id)}>
            <Button size="sm">Пройти</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

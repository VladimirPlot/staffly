import { Eye, EyeOff, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import type { ExamProgressDto, TrainingExamDto } from "../api/types";
import type { PracticeExamStatus } from "../utils/practiceExamStatus";
import PracticeExamStatusBadge from "./PracticeExamStatusBadge";

type Props = {
  exam: TrainingExamDto;
  canManage: boolean;
  progress?: ExamProgressDto;
  practiceStatus?: PracticeExamStatus;
  isBusy: boolean;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  onReset?: (id: number) => void;
  onEdit?: (exam: TrainingExamDto) => void;
  runRoute: string | null;
};

export default function ExamRow({
  exam,
  canManage,
  progress,
  practiceStatus,
  isBusy,
  onHide,
  onRestore,
  onDelete,
  onReset,
  onEdit,
  runRoute,
}: Props) {
  return (
    <div className="rounded-2xl border border-subtle bg-app p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-default">{exam.title}</div>
            {practiceStatus ? (
              <PracticeExamStatusBadge status={practiceStatus} isHidden={!exam.active} />
            ) : (
              <>
                <PracticeExamStatusBadge status={null} isHidden={!exam.active} />
              </>
            )}
          </div>

          {exam.description && <div className="text-sm text-muted">{exam.description}</div>}

          <div className="text-sm text-muted">
            Вопросов: {exam.questionCount} · Проходной балл: {exam.passPercent}%
            {typeof progress?.scorePercent === "number" ? ` · Последний результат: ${progress.scorePercent}%` : ""}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
          {canManage && (
            <>
              {onEdit && (
                <IconButton aria-label="Редактировать тест" title="Редактировать" onClick={() => onEdit(exam)} disabled={isBusy}>
                  <Icon icon={Pencil} size="sm" />
                </IconButton>
              )}

              {onReset && (
                <IconButton
                  aria-label="Глобально сбросить результаты"
                  title="Глобально сбросить результаты"
                  onClick={() => onReset(exam.id)}
                  disabled={isBusy}
                >
                  <Icon icon={RotateCcw} size="sm" />
                </IconButton>
              )}

              {exam.active ? (
                <IconButton aria-label="Скрыть тест" title="Скрыть" onClick={() => onHide(exam.id)} disabled={isBusy}>
                  <Icon icon={EyeOff} size="sm" />
                </IconButton>
              ) : (
                <IconButton aria-label="Восстановить тест" title="Восстановить" onClick={() => onRestore(exam.id)} disabled={isBusy}>
                  <Icon icon={Eye} size="sm" />
                </IconButton>
              )}

              <IconButton
                aria-label={exam.active ? "Скрыть тест" : "Удалить тест навсегда"}
                title={exam.active ? "Скрыть" : "Удалить навсегда"}
                onClick={() => (exam.active ? onHide(exam.id) : onDelete(exam.id))}
                disabled={isBusy}
              >
                <Icon icon={Trash2} size="sm" />
              </IconButton>
            </>
          )}

          {runRoute && (
            <Link to={runRoute}>
              <Button size="sm">Пройти</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import Button from "../../../shared/ui/Button";
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
}: Props) {
  return (
    <div className="space-y-3 rounded-2xl border border-subtle bg-app p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-medium text-default">{exam.title}</div>
        <ExamProgressBadge progress={progress} />
        {!exam.active && <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">Скрыт</span>}
      </div>
      {exam.description && <div className="text-sm text-muted">{exam.description}</div>}
      <div className="text-sm text-muted">
        Вопросов: {exam.questionCount} · Проходной балл: {exam.passPercent}%
        {typeof progress?.scorePercent === "number" ? ` · Последний результат: ${progress.scorePercent}%` : ""}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to={trainingRoutes.examRun(exam.id)}>
          <Button size="sm">Пройти</Button>
        </Link>
        {canManage && (
          <>
            <Button variant="outline" size="sm" isLoading={isBusy} onClick={() => onReset(exam.id)}>
              Сбросить результаты
            </Button>
            {exam.active ? (
              <Button variant="outline" size="sm" isLoading={isBusy} onClick={() => onHide(exam.id)}>
                Скрыть
              </Button>
            ) : (
              <Button variant="outline" size="sm" isLoading={isBusy} onClick={() => onRestore(exam.id)}>
                Восстановить
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={exam.active}
              isLoading={isBusy}
              onClick={() => onDelete(exam.id)}
              className="disabled:opacity-40"
            >
              Удалить
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

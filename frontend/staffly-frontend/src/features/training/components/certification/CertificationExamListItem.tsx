import Button from "../../../../shared/ui/Button";
import type { TrainingExamDto } from "../../api/types";

type Props = {
  exam: TrainingExamDto;
  selected: boolean;
  canManage: boolean;
  loading: boolean;
  onSelect: (examId: number) => void;
  onAction: (examId: number, action: "hide" | "restore" | "delete") => void;
};

export default function CertificationExamListItem({ exam, selected, canManage, loading, onSelect, onAction }: Props) {
  return (
    <div className={`rounded-xl border p-3 ${selected ? "border-primary" : "border-subtle"}`}>
      <button type="button" onClick={() => onSelect(exam.id)} className="w-full text-left">
        <div className="font-medium text-default">{exam.title}</div>
        <div className="text-xs text-muted">Вопросов: {exam.questionCount} · Проходной: {exam.passPercent}%</div>
        {!exam.active && <div className="mt-1 text-xs text-amber-700">Скрыт</div>}
      </button>
      {canManage && (
        <div className="mt-2 flex gap-2">
          {exam.active ? (
            <Button size="sm" variant="outline" isLoading={loading} onClick={() => onAction(exam.id, "hide")}>Скрыть</Button>
          ) : (
            <>
              <Button size="sm" variant="outline" isLoading={loading} onClick={() => onAction(exam.id, "restore")}>Восстановить</Button>
              <Button size="sm" variant="outline" isLoading={loading} onClick={() => onAction(exam.id, "delete")}>Удалить</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

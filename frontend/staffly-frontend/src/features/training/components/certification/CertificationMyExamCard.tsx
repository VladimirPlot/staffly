import { Link } from "react-router-dom";
import type { TrainingExamDto } from "../../api/types";
import { trainingRoutes } from "../../utils/trainingRoutes";

type Props = {
  exam: TrainingExamDto;
};

function formatDuration(seconds?: number | null): string {
  if (seconds == null) return "Без ограничения";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} мин`;
}

export default function CertificationMyExamCard({ exam }: Props) {
  return (
    <div className="rounded-xl border border-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-default">{exam.title}</div>
          {exam.description && <div className="mt-1 text-sm text-muted">{exam.description}</div>}
        </div>
        {!exam.active && <span className="text-xs text-amber-700">Скрыт в управлении</span>}
      </div>

      <div className="mt-2 text-sm text-muted">
        Вопросов: {exam.questionCount} · Проходной: {exam.passPercent}% · Попыток: {exam.attemptLimit ?? "∞"} · Время: {formatDuration(exam.timeLimitSec)}
      </div>

      <div className="mt-3">
        <Link to={trainingRoutes.examRun(exam.id)} className="inline-flex items-center rounded-xl border border-subtle px-3 py-2 text-sm font-medium text-default hover:bg-app">
          Открыть аттестацию
        </Link>
      </div>
    </div>
  );
}

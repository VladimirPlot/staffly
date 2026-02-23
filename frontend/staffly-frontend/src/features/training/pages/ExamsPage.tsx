import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import ExamList from "../components/ExamList";
import LoadingState from "../components/LoadingState";
import { useExamProgress } from "../hooks/useExamProgress";
import { useExams } from "../hooks/useExams";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function ExamsPage() {
  const { restaurantId, canManage } = useTrainingAccess();
  const examsState = useExams({ restaurantId, canManage });
  const progressState = useExamProgress(restaurantId);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Аттестации" }]} />
      <h2 className="text-2xl font-semibold">🏁 Аттестации</h2>

      {canManage && (
        <label className="inline-flex items-center gap-2 text-sm text-default">
          <input
            type="checkbox"
            checked={examsState.includeInactive}
            onChange={(e) => examsState.setIncludeInactive(e.target.checked)}
          />
          Показывать скрытые
        </label>
      )}

      {(examsState.loading || progressState.loading) && <LoadingState label="Загрузка аттестаций…" />}
      {examsState.error && <ErrorState message={examsState.error} onRetry={examsState.reload} />}
      {progressState.error && <ErrorState message={progressState.error} onRetry={progressState.reload} />}

      {!examsState.loading && !examsState.error && examsState.exams.length === 0 && (
        <EmptyState title="Аттестаций пока нет" description="Когда они появятся, их можно будет пройти здесь." />
      )}

      {examsState.exams.length > 0 && (
        <ExamList
          exams={examsState.exams}
          canManage={canManage}
          progressByExamId={progressState.progressByExamId}
          actionLoadingId={examsState.actionLoadingId}
          onHide={examsState.hide}
          onRestore={examsState.restore}
          onDelete={examsState.remove}
          onReset={examsState.resetResults}
        />
      )}
    </div>
  );
}

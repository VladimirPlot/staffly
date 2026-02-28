import { Plus } from "lucide-react";
import { useState } from "react";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ExamList from "../components/ExamList";
import ExamEditorModal from "../components/ExamEditorModal";
import LoadingState from "../components/LoadingState";
import { deleteExam, hideExam, resetExamResults, restoreExam } from "../api/trainingApi";
import { useExamProgress } from "../hooks/useExamProgress";
import { useExams } from "../hooks/useExams";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function ExamsPage() {
  const { restaurantId, canManage } = useTrainingAccess();
  const examsState = useExams({ restaurantId, canManage, certificationOnly: true });
  const progressState = useExamProgress(restaurantId);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const action = async (fn: () => Promise<void>) => {
    try { await fn(); await examsState.reload(); } catch (e) { setError(getTrainingErrorMessage(e, "Не удалось выполнить действие.")); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Аттестации" }]} />
      <h2 className="text-2xl font-semibold">Аттестации</h2>
      {canManage && (
        <div className="border-subtle bg-surface rounded-2xl border p-3 flex items-center justify-between">
          <Switch label="Скрытые элементы" checked={examsState.includeInactive} onChange={(event) => examsState.setIncludeInactive(event.target.checked)} />
          <Button variant="outline" onClick={() => { setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" />Создать аттестацию</Button>
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {(examsState.loading || progressState.loading) && <LoadingState label="Загрузка аттестаций..." />}
      {!examsState.loading && examsState.exams.length === 0 && <EmptyState title="Нет аттестаций" description="Создайте первую аттестацию." />}
      {!examsState.loading && examsState.exams.length > 0 && (
        <ExamList
          exams={examsState.exams}
          canManage={canManage}
          actionLoadingId={examsState.actionLoadingId}
          progressByExamId={progressState.progressByExamId}
          onHide={(id) => action(() => hideExam(restaurantId!, id).then(() => undefined))}
          onRestore={(id) => action(() => restoreExam(restaurantId!, id).then(() => undefined))}
          onDelete={(id) => action(() => deleteExam(restaurantId!, id))}
          onReset={(id) => action(() => resetExamResults(restaurantId!, id))}
        />
      )}
      {restaurantId && (
        <ExamEditorModal
          open={modalOpen}
          restaurantId={restaurantId}
          mode="CERTIFICATION"
          onClose={() => setModalOpen(false)}
          onSaved={examsState.reload}
        />
      )}
    </div>
  );
}

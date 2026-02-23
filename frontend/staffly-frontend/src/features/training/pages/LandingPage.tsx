import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import SectionCard from "../components/SectionCard";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingLandingData } from "../hooks/useTrainingLandingData";
import { trainingLabels } from "../utils/trainingLabels";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function LandingPage() {
  const { restaurantId, canManage, loading: accessLoading } = useTrainingAccess();
  const { knowledgeFoldersCount, questionFoldersCount, examsCount, loading, error, reload } =
    useTrainingLandingData({ restaurantId, canManage });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг" }]} />
      <h2 className="text-2xl font-semibold">LMS: обучение и аттестации</h2>

      {(loading || accessLoading) && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !accessLoading && !error && (
        <div className="space-y-4">
          <SectionCard
            title={trainingLabels.knowledge}
            description="Папки и материалы для сотрудников."
            countLabel="Папок"
            countValue={knowledgeFoldersCount}
            to={trainingRoutes.knowledge}
          />

          {canManage && (
            <SectionCard
              title={trainingLabels.questionBank}
              description="Менеджерская зона для формирования вопросов."
              countLabel="Папок"
              countValue={questionFoldersCount}
              to={trainingRoutes.questionBank}
            />
          )}

          <SectionCard
            title={trainingLabels.exams}
            description="Запуски аттестаций и история результатов."
            countLabel="Экзаменов"
            countValue={examsCount}
            to={trainingRoutes.exams}
          />
        </div>
      )}
    </div>
  );
}

import { BookOpen, Brain, FileCheck2 } from "lucide-react";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import LoadingState from "../components/LoadingState";
import SectionCard from "../components/SectionCard";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function LandingPage() {
  const { canManage, loading: accessLoading } = useTrainingAccess();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг" }]} />
      <h2 className="text-2xl font-semibold">LMS: обучение и аттестации</h2>

      {accessLoading && <LoadingState />}

      {!accessLoading && (
        <div className="space-y-4">
          <SectionCard
            title="База знаний"
            description="Папки и материалы для сотрудников."
            to={trainingRoutes.knowledge}
            icon={BookOpen}
          />

          {canManage && (
            <SectionCard
              title="Банк вопросов"
              description="Менеджерская зона для формирования вопросов."
              to={trainingRoutes.questionBank}
              icon={Brain}
            />
          )}

          <SectionCard
            title="Аттестации"
            description="Запуски аттестаций и история результатов."
            to={trainingRoutes.exams}
            icon={FileCheck2}
          />
        </div>
      )}
    </div>
  );
}

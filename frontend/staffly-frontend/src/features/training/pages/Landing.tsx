import { useEffect, useState } from "react";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Card from "../../../shared/ui/Card";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { listExams, listFolders, type TrainingExamDto, type TrainingFolderDto } from "../api";

export default function TrainingLandingPage() {
  const { restaurantId, canManage } = useTrainingAccess();
  const [knowledgeFolders, setKnowledgeFolders] = useState<TrainingFolderDto[]>([]);
  const [questionFolders, setQuestionFolders] = useState<TrainingFolderDto[]>([]);
  const [exams, setExams] = useState<TrainingExamDto[]>([]);

  useEffect(() => {
    if (!restaurantId) return;
    void (async () => {
      const [knowledge, questions, examsData] = await Promise.all([
        listFolders(restaurantId, "KNOWLEDGE"),
        listFolders(restaurantId, "QUESTION_BANK"),
        listExams(restaurantId),
      ]);
      setKnowledgeFolders(knowledge);
      setQuestionFolders(questions);
      setExams(examsData);
    })();
  }, [restaurantId]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг" }]} />
      <h2 className="text-2xl font-semibold">LMS: обучение и аттестации</h2>

      <Card>
        <div className="text-lg font-semibold">📚 База знаний</div>
        <div className="mt-1 text-sm text-muted">Папки и карточки для сотрудников.</div>
        <div className="mt-2 text-sm">Папок: {knowledgeFolders.length}</div>
      </Card>

      {canManage && (
        <Card>
          <div className="text-lg font-semibold">🧠 Банк вопросов</div>
          <div className="mt-1 text-sm text-muted">Менеджерская зона управления вопросами.</div>
          <div className="mt-2 text-sm">Папок: {questionFolders.length}</div>
        </Card>
      )}

      <Card>
        <div className="text-lg font-semibold">🏁 Аттестации</div>
        <div className="mt-1 text-sm text-muted">Запуски экзаменов и история попыток.</div>
        <div className="mt-2 text-sm">Экзаменов: {exams.length}</div>
      </Card>
    </div>
  );
}

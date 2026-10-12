// Isolated browser fixture: uses real screens/editors, all API calls stay in this adapter.
// Open /tests/training-ux.html with Vite. No authentication or database is used.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Link, RouterProvider } from "react-router-dom";
import apiClient from "../src/shared/api/apiClient";
import { ExamRunScreen } from "../src/features/training/pages/ExamRunPage";
import ExamEditorModal from "../src/features/training/components/ExamEditorModal";
import QuestionEditorModal from "../src/features/training/components/questionEditor/QuestionEditorModal";
import TrainingFolderModal from "../src/features/training/components/TrainingFolderModal";
import KnowledgeItemModal from "../src/features/training/components/KnowledgeItemModal";
import "../src/index.css";

let starts = 0;
let saves = 0;
let failTree = true;
const failureScenario = new URL(window.location.href).searchParams.get("failure");
let failPositions = failureScenario === "positions";
let failQuestions = failureScenario === "questions";
let notify = () => {};
const position = { id: 1, name: "Официант", active: true, level: "STAFF" };
const folder = {
  id: 1,
  restaurantId: 1,
  parentId: null,
  name: "Меню",
  type: "QUESTION_BANK",
  active: true,
  questionCount: 1,
  sortOrder: 0,
  visibilityPositionIds: [],
  manageable: true,
  children: [],
};
const exam = {
  id: 1,
  title: "Тестовая аттестация",
  mode: "CERTIFICATION",
  questionCount: 1,
  passPercent: 70,
  timeLimitSec: 120,
  version: 1,
  attemptLimit: 3,
};
apiClient.defaults.adapter = async (config) => {
  let data: unknown = [];
  const url = config.url ?? "";
  if (url.endsWith("/start")) {
    starts++;
    notify();
    data = {
      attemptId: 1,
      startedAt: new Date().toISOString(),
      examVersion: 1,
      exam,
      questions: [
        { questionId: 10, type: "SINGLE", prompt: "Какой ответ выбрать?", options: [{ text: "Первый", sortOrder: 0 }] },
      ],
      savedAnswers: [],
    };
  } else if (url.endsWith("/submit")) {
    data = { passed: true, scorePercent: 100 };
  } else if (url.includes("sources/preflight")) {
    data = { valid: true, availableQuestionCount: 1, issues: [] };
  } else if (url.includes("question-bank/tree")) {
    if (failTree) {
      failTree = false;
      throw new Error("Тестовая ошибка загрузки банка");
    }
    data = [folder];
  } else if (url.includes("/positions")) {
    if (failPositions) {
      failPositions = false;
      throw new Error("Тестовая ошибка загрузки должностей");
    }
    data = [position];
  } else if (config.method === "get" && url.includes("/questions")) {
    if (failQuestions) {
      failQuestions = false;
      throw new Error("Тестовая ошибка загрузки вопросов");
    }
    data = [{ id: 10, title: "Вопрос", type: "SINGLE", questionGroup: "CERTIFICATION", prompt: "Первый?" }];
  } else if (config.method !== "get") {
    if (!url.includes("/answer")) {
      saves++;
      notify();
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    data = { id: 9, imageUrl: null };
  }
  return { data, status: 200, statusText: "OK", headers: {}, config };
};
const roles = ["STAFF"] as const;
function Fixture() {
  const [, update] = useState(0);
  notify = () => update((value) => value + 1);
  const [editor, setEditor] = useState<string | null>(null);
  const close = () => setEditor(null);
  return (
    <div className="space-y-4 p-5">
      <p>
        Изолированные данные · Запусков: {starts} · Сохранений: {saves}
      </p>
      <Link to="/tests/training-ux.html/run">Открыть аттестацию</Link>
      <div className="flex gap-3">
        {["Тест", "Вопрос", "Папка", "Карточка"].map((name) => (
          <button key={name} onClick={() => setEditor(name)}>
            Редактор: {name}
          </button>
        ))}
      </div>
      <ExamEditorModal
        open={editor === "Тест"}
        restaurantId={1}
        mode="CERTIFICATION"
        certificationAllowedAudienceRoles={[...roles]}
        onClose={close}
        onSaved={() => {}}
      />
      <QuestionEditorModal
        open={editor === "Вопрос"}
        restaurantId={1}
        folderId={1}
        onClose={close}
        onSaved={() => {}}
      />
      <TrainingFolderModal
        open={editor === "Папка"}
        restaurantId={1}
        type="KNOWLEDGE"
        mode="create"
        onClose={close}
        onSaved={() => {}}
      />
      <KnowledgeItemModal
        open={editor === "Карточка"}
        restaurantId={1}
        mode="create"
        onClose={close}
        onSaved={() => {}}
      />
    </div>
  );
}
const router = createBrowserRouter([
  { path: "/tests/training-ux.html", element: <Fixture /> },
  {
    path: "/tests/training-ux.html/run",
    element: (
      <>
        <p className="p-2">Изолированный тест</p>
        <ExamRunScreen restaurantId={1} examId={1} folderId={null} />
      </>
    ),
  },
  {
    path: "*",
    element: (
      <div className="p-5">
        <p>Переход выполнен</p>
        <Link to="/tests/training-ux.html">К тестовой странице</Link>
      </div>
    ),
  },
]);
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);

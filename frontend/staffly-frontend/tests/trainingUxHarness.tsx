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
import TrainingArchiveModal from "../src/features/training/components/TrainingArchiveModal";
import type {
  TrainingFolderDto,
  TrainingKnowledgeItemDto,
  TrainingQuestionDto,
} from "../src/features/training/api/types";
import "../src/index.css";

let starts = 0;
let saves = 0;
let savedTimeLimit: number | null | undefined;
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
const sourceQuestion: TrainingQuestionDto = {
  id: 10,
  restaurantId: 1,
  folderId: 1,
  title: "Похожее название вопроса",
  prompt: "Какой из вариантов нужно выбрать?",
  type: "SINGLE",
  questionGroup: "CERTIFICATION",
  active: true,
  sortOrder: 0,
  options: [
    { text: "Первый вариант", correct: true, sortOrder: 0 },
    { text: "Второй вариант", correct: false, sortOrder: 1 },
  ],
  matchPairs: [],
  blanks: [],
  explanation: "Пояснение правильного ответа.",
};
const sourceQuestions: TrainingQuestionDto[] = [
  sourceQuestion,
  { ...sourceQuestion, id: 11, type: "MULTI" },
  {
    ...sourceQuestion,
    id: 12,
    type: "TRUE_FALSE",
    options: [
      { text: "Правда", correct: true, sortOrder: 0 },
      { text: "Ложь", correct: false, sortOrder: 1 },
    ],
  },
  {
    ...sourceQuestion,
    id: 13,
    type: "MATCH",
    options: [],
    matchPairs: [{ leftText: "Блюдо", rightText: "Ингредиент", sortOrder: 0 }],
  },
  {
    ...sourceQuestion,
    id: 14,
    type: "FILL_SELECT",
    prompt: "Выберите {{1}}.",
    options: [],
    blanks: [{ index: 1, options: [{ text: "Пропущенное слово", correct: true, sortOrder: 0 }] }],
  },
];
const archiveFolders: TrainingFolderDto[] = [
  {
    id: 201,
    restaurantId: 1,
    parentId: null,
    name: "Кухня",
    type: "KNOWLEDGE",
    active: false,
    sortOrder: 0,
    visibilityPositionIds: [],
    manageable: true,
  },
  {
    id: 301,
    restaurantId: 1,
    parentId: 201,
    name: "Инструкции",
    type: "KNOWLEDGE",
    active: false,
    sortOrder: 0,
    visibilityPositionIds: [],
    manageable: true,
  },
  {
    id: 202,
    restaurantId: 1,
    parentId: null,
    name: "Зал",
    type: "KNOWLEDGE",
    active: true,
    sortOrder: 0,
    visibilityPositionIds: [],
    manageable: true,
  },
];
const archiveItems: TrainingKnowledgeItemDto[] = [
  { id: 401, restaurantId: 1, folderId: 301, title: "Инструкция", sortOrder: 0, active: false },
  { id: 402, restaurantId: 1, folderId: 202, title: "Инструкция", sortOrder: 0, active: false },
];
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
    data = sourceQuestions;
  } else if (config.method !== "get") {
    if (!url.includes("/answer")) {
      if (typeof config.data === "string") {
        const payload = JSON.parse(config.data);
        if ("timeLimitSec" in payload) savedTimeLimit = payload.timeLimitSec;
      }
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
        {savedTimeLimit !== undefined && <> · Сохранённый лимит: {savedTimeLimit ?? "без ограничения"} сек</>}
      </p>
      <Link to="/tests/training-ux.html/run">Открыть аттестацию</Link>
      <div className="flex flex-wrap gap-3">
        {["Тест", "Вопрос", "Папка", "Карточка", "Архив"].map((name) => (
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
      <TrainingArchiveModal
        open={editor === "Архив"}
        folders={archiveFolders}
        knowledgeItems={archiveItems}
        loading={false}
        error={null}
        actionLoading={null}
        onClose={close}
        showDeleteAll={false}
        onDelete={() => {}}
        onDeleteAll={() => {}}
        onRestore={(object) => {
          object.value.active = true;
          update((value) => value + 1);
        }}
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

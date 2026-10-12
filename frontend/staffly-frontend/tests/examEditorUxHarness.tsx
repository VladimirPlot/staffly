// Real exam editors; all HTTP stays in this fixture adapter. No working data is used.
import { useState } from "react";
import { AxiosError } from "axios";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import apiClient from "../src/shared/api/apiClient";
import ExamEditorModal from "../src/features/training/components/ExamEditorModal";
import type { TrainingExamMode, TrainingExamDto } from "../src/features/training/api/types";
import "../src/index.css";

const positions = [
  { id: 1, name: "Официант" },
  { id: 2, name: "Бармен" },
  { id: 3, name: "Уборщица" },
].map((position) => ({ ...position, active: true, level: "STAFF" }));
const folders = [5, 6].map((id) => ({
  id,
  restaurantId: 1,
  name: id === 5 ? "Папка A" : "Папка B",
  type: "QUESTION_BANK",
  active: true,
  sortOrder: id,
  visibilityPositionIds: [],
  manageable: true,
  questionCount: 3,
  children: [],
}));
const questions = [5, 6].flatMap((folderId) =>
  [1, 2, 3].map((index) => ({
    id: folderId * 100 + index,
    restaurantId: 1,
    folderId,
    title: `${folderId === 5 ? "A" : "B"}${index}`,
    prompt: `Формулировка вопроса ${folderId === 5 ? "A" : "B"}${index}`,
    type: "SINGLE",
    active: true,
    sortOrder: index,
    options: [{ text: "Ответ", correct: true, sortOrder: 0 }],
    matchPairs: [],
    blanks: [],
  })),
);
folders.push({
  ...folders[0],
  id: 8,
  name: "Вопросы для официантов",
  questionCount: 0,
  children: [{ ...folders[0], id: 9, name: "Глубже", questionCount: 1, children: [] }],
} as (typeof folders)[number]);
questions.push({
  ...questions[0],
  id: 901,
  folderId: 9,
  title: "Перенесённый вопрос",
  prompt: "Вопрос теперь в подпапке",
});
const movedExam: TrainingExamDto = {
  id: 10,
  restaurantId: 1,
  title: "Опубликованная аттестация",
  questionCount: 1,
  passPercent: 80,
  mode: "CERTIFICATION",
  knowledgeFolderId: null,
  folderId: 20,
  attemptLimit: 2,
  version: 1,
  editorRevision: 4,
  sortOrder: 0,
  active: true,
  visibilityPositionIds: [1],
  sourcesFolders: [{ folderId: 8, pickMode: "ALL" }],
  sourceQuestionIds: [],
};
let writes = 0;
let saved: { visibilityPositionIds?: number[]; sourceQuestionIds?: number[] } | null = null;
let notify = () => {};
apiClient.defaults.adapter = async (config) => {
  const url = config.url ?? "";
  let data: unknown = [];
  if (url.includes("/positions")) data = positions;
  else if (url.includes("question-bank/tree")) data = folders;
  else if (url.endsWith("/questions"))
    data = questions.filter(
      (question) =>
        question.folderId === Number(config.params?.folderId) &&
        (!config.params?.q ||
          question.prompt.toLowerCase().includes(String(config.params.q).toLowerCase()) ||
          question.title.toLowerCase().includes(String(config.params.q).toLowerCase())),
    );
  else if (url.includes("sources/preflight")) {
    const payload = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    const pool = new Set<number>(payload.sourceQuestionIds);
    const issues: string[] = [];
    if (!(payload.examId && !payload.refreshQuestionBank)) {
      for (const source of payload.sourcesFolders) {
        const available = questions.filter(
          (q) =>
            q.folderId === source.folderId || (source.folderId === 8 && source.includeDescendants && q.folderId === 9),
        );
        const candidates =
          source.pickMode === "RANDOM" ? available.filter((q) => !payload.sourceQuestionIds.includes(q.id)) : available;
        if (!available.length) issues.push("В выбранной области нет вопросов");
        if (source.pickMode === "RANDOM" && source.randomCount > candidates.length)
          issues.push("Недостаточно вопросов для случайной выборки");
        (source.pickMode === "RANDOM" ? candidates.slice(0, source.randomCount ?? 1) : candidates).forEach((q) =>
          pool.add(q.id),
        );
      }
    }
    const count = payload.examId && !payload.refreshQuestionBank ? 1 : pool.size;
    if (!count) issues.push("Выберите вопросы");
    const audience = payload.visibilityPositionIds;
    const excluded =
      audience == null
        ? []
        : positions.filter(
            (position) => position.id !== 1 && (audience.length === 0 || audience.includes(position.id)),
          );
    data = {
      valid: count > 0 && issues.length === 0,
      availableQuestionCount: count,
      issues,
      folderVisibilityWarnings: excluded.length
        ? [
            `Аудитория теста шире настроенной видимости папки «Только официанты»: ${excluded.map((position) => position.name).join(", ")}. Эти должности не входят в видимость этой папки или её родителей. Вы можете в любой момент перенести тест в папку с подходящей видимостью.${payload.mode === "CERTIFICATION" ? " Назначенная аттестация остаётся доступной сотрудникам в личном списке: её аудитория не меняется." : ""}`,
          ]
        : [],
    };
  } else if (config.method !== "get") {
    const payload = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    if (config.method === "put" && payload.refreshQuestionBank && !payload.confirmNewVersion) {
      throw new AxiosError("New version", "ERR_BAD_REQUEST", config, undefined, {
        data: {
          error: "MATERIAL_CHANGE_REQUIRES_NEW_CYCLE",
          message: "Подтвердите новую версию",
          meta: { currentVersion: 1, proposedVersion: 2 },
        },
        status: 409,
        statusText: "Conflict",
        headers: {},
        config,
      });
    }
    saved = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    writes++;
    notify();
    data = { id: 10 };
  }
  return { data, status: 200, statusText: "OK", headers: {}, config };
};

function Fixture() {
  const [mode, setMode] = useState<TrainingExamMode | null>(null);
  const [editingMoved, setEditingMoved] = useState(false);
  const [, tick] = useState(0);
  notify = () => tick((value) => value + 1);
  return (
    <main className="bg-app text-default min-h-screen space-y-4 p-6">
      <h1>Редакторы тестов — изолированная проверка</h1>
      <div className="flex gap-3">
        <button
          className="rounded-xl border p-3"
          onClick={() => {
            setEditingMoved(true);
            setMode("CERTIFICATION");
          }}
        >
          Аттестация после переноса вопроса
        </button>
        <button className="rounded-xl border p-3" onClick={() => setMode("CERTIFICATION")}>
          Новая аттестация
        </button>
        <button className="rounded-xl border p-3" onClick={() => setMode("PRACTICE")}>
          Новый учебный тест
        </button>
      </div>
      <p role="status">
        Записей: {writes}; аудитория: {JSON.stringify(saved?.visibilityPositionIds ?? null)}; вопросы:{" "}
        {JSON.stringify(saved?.sourceQuestionIds ?? null)}
      </p>
      {mode ? (
        <ExamEditorModal
          open
          restaurantId={1}
          mode={mode}
          exam={editingMoved ? movedExam : null}
          initialFolderId={20}
          knowledgeFolderId={20}
          certificationAllowedAudienceRoles={["STAFF"]}
          onClose={() => {
            setMode(null);
            setEditingMoved(false);
          }}
          onSaved={() => {}}
        />
      ) : null}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <RouterProvider router={createBrowserRouter([{ path: "/tests/exam-editor-ux.html", element: <Fixture /> }])} />,
);

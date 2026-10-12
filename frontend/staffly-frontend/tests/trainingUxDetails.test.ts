import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./registerTsx.ts";
import type { TrainingFolderDto, TrainingQuestionDto } from "../src/features/training/api/types.ts";
const { formatTrainingDuration } = await import("../src/features/training/utils/duration.ts");
const { trainingArchiveContext } = await import("../src/features/training/utils/archiveContext.ts");
const { default: QuestionSourcePreview } = await import(
  "../src/features/training/components/examEditor/QuestionSourcePreview.tsx"
);

test("short and mixed durations keep all seconds and distinguish unlimited from zero", () => {
  assert.equal(formatTrainingDuration(30), "30 сек");
  assert.equal(formatTrainingDuration(90), "1 мин 30 сек");
  assert.equal(formatTrainingDuration(120), "2 мин");
  assert.equal(formatTrainingDuration(0), "0 сек");
  assert.equal(formatTrainingDuration(null), "Без ограничения");
  assert.equal(formatTrainingDuration(undefined, "—"), "—");
});
const folder = (id: number, parentId: number | null, name: string, active = true): TrainingFolderDto => ({
  id,
  parentId,
  name,
  active,
  restaurantId: 1,
  type: "KNOWLEDGE",
  sortOrder: 0,
  visibilityPositionIds: [],
  manageable: true,
});
test("archive paths distinguish duplicate titles and block on the outermost hidden ancestor", () => {
  const folders = [folder(1, null, "Кухня", false), folder(2, 1, "Инструкции", false), folder(3, null, "Зал")];
  assert.deepEqual(trainingArchiveContext(2, folders, "База знаний"), {
    path: "База знаний / Кухня / Инструкции",
    restoreDisabledReason: "Сначала восстановите папку «Кухня».",
  });
  assert.equal(trainingArchiveContext(3, folders, "База знаний").path, "База знаний / Зал");
  folders[0].active = true;
  assert.equal(
    trainingArchiveContext(2, folders, "База знаний").restoreDisabledReason,
    "Сначала восстановите папку «Инструкции».",
  );
  folders[1].active = true;
  assert.equal(trainingArchiveContext(2, folders, "База знаний").restoreDisabledReason, undefined);
  assert.equal(trainingArchiveContext(null, folders, "База знаний").path, "База знаний");
});
test("incomplete or cyclic archive ancestry cannot silently appear as a root object", () => {
  assert.match(trainingArchiveContext(8, [], "Банк вопросов").restoreDisabledReason!, /недоступна/);
  assert.match(
    trainingArchiveContext(1, [folder(1, 2, "A"), folder(2, 1, "B")], "База знаний").restoreDisabledReason!,
    /недоступна/,
  );
});
const question: TrainingQuestionDto = {
  id: 1,
  restaurantId: 1,
  folderId: 1,
  type: "SINGLE",
  questionGroup: "CERTIFICATION",
  title: "Вопрос",
  prompt: "Полная формулировка",
  sortOrder: 0,
  active: true,
  options: [
    { text: "Верный вариант", correct: true, sortOrder: 0 },
    { text: "Другой вариант", correct: false, sortOrder: 1 },
  ],
  matchPairs: [],
  blanks: [],
};
test("question preview shows wording and answer choices for every supported type", () => {
  for (const type of ["SINGLE", "MULTI", "TRUE_FALSE"] as const) {
    const html = renderToStaticMarkup(React.createElement(QuestionSourcePreview, { question: { ...question, type } }));
    assert.match(html, /Полная формулировка/);
    assert.match(html, /Верный вариант/);
    assert.match(html, /Другой вариант/);
    assert.match(html, /Верный ответ/);
  }
  const matching = renderToStaticMarkup(
    React.createElement(QuestionSourcePreview, {
      question: {
        ...question,
        type: "MATCH",
        options: [],
        matchPairs: [{ leftText: "Левая часть", rightText: "Правая часть", sortOrder: 0 }],
      },
    }),
  );
  assert.match(matching, /Левая часть.*Правая часть/);
  const blanks = renderToStaticMarkup(
    React.createElement(QuestionSourcePreview, {
      question: {
        ...question,
        type: "FILL_SELECT",
        options: [],
        blanks: [{ index: 1, options: [{ text: "Вставка", correct: true, sortOrder: 0 }] }],
      },
    }),
  );
  assert.match(blanks, /Пропуск 1/);
  assert.match(blanks, /Вставка/);
});

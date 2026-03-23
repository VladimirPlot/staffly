import type { AttemptQuestionSnapshotDto, TrainingQuestionType } from "../../api/types";
import { parseJson } from "./storage";
import type { FillBlankAnswer, MatchPairAnswer } from "./types";

export function isMulti(type: TrainingQuestionType) {
  return type === "MULTI";
}

export function isMatch(type: TrainingQuestionType) {
  return type === "MATCH";
}

export function isSingleLike(type: TrainingQuestionType) {
  return type === "SINGLE" || type === "TRUE_FALSE";
}

export function getQuestionValidationError(
  question: AttemptQuestionSnapshotDto,
  raw: string | undefined,
): string | null {
  if (isSingleLike(question.type)) {
    const value = parseJson<string>(raw);
    return !value || !value.trim() ? "Выберите один вариант ответа." : null;
  }

  if (isMulti(question.type)) {
    const values = parseJson<string[]>(raw);
    return !Array.isArray(values) || values.length === 0 ? "Выберите хотя бы один вариант ответа." : null;
  }

  if (question.type === "FILL_SELECT" && question.blanks.length > 0) {
    const values = parseJson<FillBlankAnswer[]>(raw);
    if (!Array.isArray(values)) return "Заполните все пропуски.";
    const byIndex = new Map(values.map((item) => [item.blankIndex, item.value]));
    for (const blank of question.blanks) {
      const value = byIndex.get(blank.blankIndex);
      if (!value || !value.trim()) return "Заполните все пропуски.";
    }
    return null;
  }

  if (question.type === "FILL_SELECT") {
    const value = parseJson<string>(raw);
    return !value || !value.trim() ? "Выберите вариант ответа." : null;
  }

  if (isMatch(question.type)) {
    const values = parseJson<MatchPairAnswer[]>(raw);
    if (!Array.isArray(values)) return "Заполните все соответствия.";

    const lefts = new Set(question.matchPairs.map((pair) => pair.leftText));
    const allowedRight = new Set(question.matchPairs.map((pair) => pair.rightText));
    const usedRight = new Set<string>();

    if (values.length !== lefts.size) return "Заполните все соответствия.";

    for (const item of values) {
      if (!lefts.has(item.left)) return "Некорректные соответствия.";
      if (!item.right || !item.right.trim()) return "Заполните все соответствия.";
      if (!allowedRight.has(item.right)) return "Некорректные соответствия.";
      if (usedRight.has(item.right)) return "В соответствиях не должно быть повторов.";
      usedRight.add(item.right);
    }
  
    return null;
  }

  return raw ? null : "Ответьте на вопрос, чтобы продолжить.";
}

export function createEmptyMatchPayload(question: AttemptQuestionSnapshotDto) {
  const pairs = [...question.matchPairs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const payload: MatchPairAnswer[] = pairs.map((pair) => ({ left: pair.leftText, right: "" }));
  return JSON.stringify(payload);
}

export function parseStringAnswer(raw: string | undefined) {
  try {
    return raw ? (JSON.parse(raw) as string) : null;
  } catch {
    return null;
  }
}

export function parseStringArrayAnswer(raw: string | undefined) {
  try {
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseMatchAnswer(raw: string | undefined, question: AttemptQuestionSnapshotDto) {
  try {
    const parsed = raw
      ? (JSON.parse(raw) as MatchPairAnswer[])
      : (JSON.parse(createEmptyMatchPayload(question)) as MatchPairAnswer[]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseFillBlankAnswer(raw: string | undefined) {
  try {
    const parsed = raw ? (JSON.parse(raw) as FillBlankAnswer[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

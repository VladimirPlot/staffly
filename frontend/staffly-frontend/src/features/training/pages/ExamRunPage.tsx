import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import { listFolders, startExam, submitExamAttempt } from "../api/trainingApi";
import type {
  AttemptQuestionSnapshotDto,
  ExamAttemptDto,
  ExamSubmitResultDto,
  TrainingFolderDto,
  TrainingQuestionType,
} from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { buildExamRunBreadcrumbs } from "../utils/examRunBreadcrumbs";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

type MatchPairAnswer = { left: string; right: string };
type FillBlankAnswer = { blankIndex: number; value: string };
type PersistedExamRunState = {
  attemptId: number;
  answers: Record<number, string>;
  currentIndex: number;
  confirmedQuestionIds: number[];
};

function isMulti(type: TrainingQuestionType) {
  return type === "MULTI";
}
function isMatch(type: TrainingQuestionType) {
  return type === "MATCH";
}
function isSingleLike(type: TrainingQuestionType) {
  return type === "SINGLE" || type === "TRUE_FALSE";
}

function getStorageKey(examId: number) {
  return `training_exam_run_${examId}`;
}

function parseJson<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatRemainingTime(totalSec: number) {
  const safeSec = Math.max(0, totalSec);
  const minutes = Math.floor(safeSec / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(safeSec % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getQuestionValidationError(q: AttemptQuestionSnapshotDto, raw: string | undefined): string | null {
  if (isSingleLike(q.type)) {
    const value = parseJson<string>(raw);
    if (!value || !value.trim()) return "Выберите один вариант ответа.";
    return null;
  }

  if (isMulti(q.type)) {
    const values = parseJson<string[]>(raw);
    if (!Array.isArray(values) || values.length === 0) return "Выберите хотя бы один вариант ответа.";
    return null;
  }

  if (q.type === "FILL_SELECT" && q.blanks.length > 0) {
    const values = parseJson<FillBlankAnswer[]>(raw);
    if (!Array.isArray(values)) return "Заполните все пропуски.";
    const byIndex = new Map(values.map((x) => [x.blankIndex, x.value]));
    for (const blank of q.blanks) {
      const value = byIndex.get(blank.blankIndex);
      if (!value || !value.trim()) return "Заполните все пропуски.";
    }
    return null;
  }

  if (q.type === "FILL_SELECT") {
    const value = parseJson<string>(raw);
    if (!value || !value.trim()) return "Выберите вариант ответа.";
    return null;
  }

  if (isMatch(q.type)) {
    const values = parseJson<MatchPairAnswer[]>(raw);
    if (!Array.isArray(values)) return "Заполните все соответствия.";

    const lefts = new Set(q.matchPairs.map((p) => p.leftText));
    const allowedRight = new Set(q.matchPairs.map((p) => p.rightText));
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

function measureTextWidth(text: string, font = '500 16px system-ui') {
  if (typeof document === "undefined") return 0;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return 0;

  context.font = font;
  return context.measureText(text).width;
}

function getFillBlankSelectWidth(blankOptions: { text: string }[], selectedValue = "") {
  const texts = blankOptions
    .map((option) => option.text.trim())
    .filter(Boolean);

  if (selectedValue.trim()) {
    texts.push(selectedValue.trim());
  }

  const longestText = texts.reduce((longest, current) => {
    return current.length > longest.length ? current : longest;
  }, "");

  const textWidth = measureTextWidth(longestText || "000000", '500 16px system-ui');

  // запас:
  // 24px слева + 32px справа под стрелку + небольшой safety gap
  const totalWidth = Math.ceil(textWidth + 16 + 28 + 16);

  return `${Math.min(Math.max(totalWidth, 84), 260)}px`;
}

function buildFillPromptParts(prompt: string) {
  const result: Array<
    | { type: "text"; value: string; key: string }
    | { type: "blank"; blankIndex: number; key: string }
  > = [];

  const regex = /\{\{(\d+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let tokenIndex = 0;

  while ((match = regex.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        type: "text",
        value: prompt.slice(lastIndex, match.index),
        key: `text-${tokenIndex}-${lastIndex}`,
      });
    }

    result.push({
      type: "blank",
      blankIndex: Number(match[1]),
      key: `blank-${tokenIndex}-${match[1]}`,
    });

    lastIndex = regex.lastIndex;
    tokenIndex += 1;
  }

  if (lastIndex < prompt.length) {
    result.push({
      type: "text",
      value: prompt.slice(lastIndex),
      key: `text-tail-${lastIndex}`,
    });
  }

  return result;
}

function renderQuestionExplanation(
  q: AttemptQuestionSnapshotDto,
  raw: string | undefined,
  isConfirmed: boolean,
) {
  if (!q.explanation || !isConfirmed) return null;
  if (getQuestionValidationError(q, raw)) return null;

  return <div className="mt-3 text-sm text-muted">{q.explanation}</div>;
}

export default function ExamRunPage() {
  const { examId, folderId } = useParams<{ examId: string; folderId?: string }>();
  const parsedExamId = Number(examId);
  const parsedFolderId = folderId ? Number(folderId) : null;
  const origin = Number.isFinite(parsedFolderId) ? "knowledge" : "exams";
  const navigate = useNavigate();
  const { restaurantId } = useTrainingAccess();

  const [attempt, setAttempt] = useState<ExamAttemptDto | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [confirmedQuestionIds, setConfirmedQuestionIds] = useState<number[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExamSubmitResultDto | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [knowledgeFolders, setKnowledgeFolders] = useState<TrainingFolderDto[]>([]);

  const backRoute =
    origin === "knowledge" && parsedFolderId != null
      ? `${trainingRoutes.knowledge}/${parsedFolderId}`
      : trainingRoutes.exams;

  const breadcrumbItems = useMemo(
    () => buildExamRunBreadcrumbs(origin, parsedFolderId, knowledgeFolders),
    [origin, parsedFolderId, knowledgeFolders],
  );

  useEffect(() => {
    if (!restaurantId || origin !== "knowledge") return;
    void listFolders(restaurantId, "KNOWLEDGE", false)
      .then(setKnowledgeFolders)
      .catch(() => setKnowledgeFolders([]));
  }, [restaurantId, origin]);

  const loadAttempt = async () => {
    if (!restaurantId || Number.isNaN(parsedExamId)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await startExam(restaurantId, parsedExamId);
      const storageKey = getStorageKey(parsedExamId);
      const persisted = parseJson<PersistedExamRunState>(localStorage.getItem(storageKey) ?? undefined);

      if (persisted && persisted.attemptId === response.attemptId) {
        setAnswers(persisted.answers ?? {});
        setCurrentIndex(
          Math.min(Math.max(persisted.currentIndex ?? 0, 0), Math.max(response.questions.length - 1, 0)),
        );
        setConfirmedQuestionIds(persisted.confirmedQuestionIds ?? []);
      } else {
        localStorage.removeItem(storageKey);
        setAnswers({});
        setConfirmedQuestionIds([]);
        setCurrentIndex(0);
      }

      setAttempt(response);
      setQuestionError(null);
      setResult(null);
      setTimeExpired(false);
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось запустить аттестацию."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, parsedExamId]);

  useEffect(() => {
    if (!attempt || Number.isNaN(parsedExamId) || result) return;
    localStorage.setItem(
      getStorageKey(parsedExamId),
      JSON.stringify({
        attemptId: attempt.attemptId,
        answers,
        currentIndex,
        confirmedQuestionIds,
      }),
    );
  }, [answers, attempt, confirmedQuestionIds, currentIndex, parsedExamId, result]);

  useEffect(() => {
    if (!attempt || attempt.exam.timeLimitSec == null || result) {
      setRemainingSec(null);
      return;
    }

    const deadline = new Date(attempt.startedAt).getTime() + attempt.exam.timeLimitSec * 1000;

    const tick = () => {
      const secondsLeft = Math.ceil((deadline - Date.now()) / 1000);
      if (secondsLeft <= 0) {
        setRemainingSec(0);
        setTimeExpired(true);
        return;
      }
      setRemainingSec(secondsLeft);
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [attempt, result]);

  const initMatchPayloadEmpty = (q: AttemptQuestionSnapshotDto) => {
    const pairs = [...q.matchPairs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const payload: MatchPairAnswer[] = pairs.map((p) => ({ left: p.leftText, right: "" }));
    return JSON.stringify(payload);
  };

  const currentQuestion = attempt?.questions[currentIndex] ?? null;
  const currentQuestionError = useMemo(() => {
    if (!currentQuestion) return null;
    return getQuestionValidationError(currentQuestion, answers[currentQuestion.questionId]);
  }, [answers, currentQuestion]);

  const isCurrentQuestionConfirmed = currentQuestion
    ? confirmedQuestionIds.includes(currentQuestion.questionId)
    : false;

  const hasUnsavedAnswers = !result && Object.keys(answers).length > 0;

  const setSingleAnswer = (q: AttemptQuestionSnapshotDto, value: string) => {
    if (confirmedQuestionIds.includes(q.questionId)) return;
    setQuestionError(null);
    setAnswers((prev) => ({ ...prev, [q.questionId]: JSON.stringify(value) }));
  };

  const setMultiAnswer = (q: AttemptQuestionSnapshotDto, value: string, checked: boolean) => {
    if (confirmedQuestionIds.includes(q.questionId)) return;
    setQuestionError(null);

    const current = answers[q.questionId];
    let arr: string[] = [];
    try {
      arr = current ? (JSON.parse(current) as string[]) : [];
      if (!Array.isArray(arr)) arr = [];
    } catch {
      arr = [];
    }

    const next = new Set(arr);
    if (checked) next.add(value);
    else next.delete(value);

    setAnswers((prev) => ({ ...prev, [q.questionId]: JSON.stringify(Array.from(next)) }));
  };

  const setMatchRight = (q: AttemptQuestionSnapshotDto, left: string, right: string) => {
    if (confirmedQuestionIds.includes(q.questionId)) return;
    setQuestionError(null);

    let payload: MatchPairAnswer[] = [];
    try {
      payload = answers[q.questionId]
        ? (JSON.parse(answers[q.questionId]) as MatchPairAnswer[])
        : (JSON.parse(initMatchPayloadEmpty(q)) as MatchPairAnswer[]);
      if (!Array.isArray(payload)) payload = [];
    } catch {
      payload = [];
    }

    const usedRights = new Set(payload.filter((p) => p.left !== left).map((p) => p.right).filter(Boolean));
    if (right && usedRights.has(right)) return;

    const next = payload.map((p) => (p.left === left ? { ...p, right } : p));
    setAnswers((prev) => ({ ...prev, [q.questionId]: JSON.stringify(next) }));
  };

  const setFillSelectAnswer = (q: AttemptQuestionSnapshotDto, blankIndex: number, value: string) => {
    if (confirmedQuestionIds.includes(q.questionId)) return;
    setQuestionError(null);

    let payload: FillBlankAnswer[] = [];
    try {
      payload = answers[q.questionId] ? (JSON.parse(answers[q.questionId]) as FillBlankAnswer[]) : [];
      if (!Array.isArray(payload)) payload = [];
    } catch {
      payload = [];
    }

    const next = payload.filter((p) => p.blankIndex !== blankIndex);
    next.push({ blankIndex, value });
    setAnswers((prev) => ({ ...prev, [q.questionId]: JSON.stringify(next) }));
  };

  const validateAllAnswered = useCallback(
    (examAttempt: ExamAttemptDto) => {
      for (const q of examAttempt.questions) {
        const validationError = getQuestionValidationError(q, answers[q.questionId]);
        if (validationError) return "Ответьте на все вопросы перед отправкой.";
      }

      return null;
    },
    [answers],
  );

  const submit = useCallback(async () => {
    if (!restaurantId || !attempt || submitting) return;

    const validationError = validateAllAnswered(attempt);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await submitExamAttempt(restaurantId, attempt.attemptId, {
        answers: attempt.questions.map((q) => {
          const answerJson = answers[q.questionId];
          return { questionId: q.questionId, answerJson };
        }),
      });
      setResult(response);
      if (!Number.isNaN(parsedExamId)) {
        localStorage.removeItem(getStorageKey(parsedExamId));
      }
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось отправить ответы."));
    } finally {
      setSubmitting(false);
    }
  }, [answers, attempt, parsedExamId, restaurantId, submitting, validateAllAnswered]);

  useEffect(() => {
    if (!timeExpired || !attempt || result || submitting) return;
    void submit();
  }, [attempt, result, submitting, timeExpired, submit]);

  const confirmCurrentAnswer = () => {
    if (!currentQuestion) return;
    setQuestionError(null);

    const validationError = getQuestionValidationError(
      currentQuestion,
      answers[currentQuestion.questionId],
    );
    if (validationError) {
      setQuestionError(validationError);
      return;
    }

    setConfirmedQuestionIds((prev) =>
      prev.includes(currentQuestion.questionId) ? prev : [...prev, currentQuestion.questionId],
    );
  };

  const goToNext = () => {
    if (!attempt || !currentQuestion) return;
    setQuestionError(null);

    if (!confirmedQuestionIds.includes(currentQuestion.questionId)) {
      setQuestionError("Сначала отправьте ответ.");
      return;
    }

    if (currentIndex === attempt.questions.length - 1) {
      void submit();
      return;
    }

    setCurrentIndex((prev) => prev + 1);
  };

  const handleExit = () => {
    if (hasUnsavedAnswers) {
      const confirmed = window.confirm("Вы уверены? Прогресс сохранён, можно продолжить позже.");
      if (!confirmed) return;
    }
    navigate(backRoute);
  };

  const renderInlineFillPrompt = (
    q: AttemptQuestionSnapshotDto,
    byIndex: Map<number, string>,
    isConfirmed: boolean,
  ) => {
    const blanksByIndex = new Map(q.blanks.map((blank) => [blank.blankIndex, blank]));
    const parts = buildFillPromptParts(q.prompt);

    return (
      <div className="text-lg font-medium leading-8 text-default">
        {parts.map((part) => {
          if (part.type === "text") {
            return (
              <span key={part.key} className="whitespace-pre-wrap">
                {part.value}
              </span>
            );
          }

          const blank = blanksByIndex.get(part.blankIndex);
          if (!blank) {
            return (
              <span key={part.key} className="whitespace-pre-wrap text-rose-600">
                {`{{${part.blankIndex}}}`}
              </span>
            );
          }

          const selectedValue = byIndex.get(blank.blankIndex) ?? "";
          const selectWidth = getFillBlankSelectWidth(blank.options, selectedValue);

          return (
            <span key={part.key} className="mx-1 inline-block align-middle">
              <select
                className="h-10 rounded-xl border border-subtle bg-surface px-2 pr-7 text-sm text-default"
                style={{ width: selectWidth, maxWidth: "100%" }}
                value={selectedValue}
                disabled={isConfirmed}
                onChange={(e) => setFillSelectAnswer(q, blank.blankIndex, e.target.value)}
              >
                <option value="">—</option>
                {blank.options.map((option) => (
                  <option key={option.text} value={option.text}>
                    {option.text}
                  </option>
                ))}
              </select>
            </span>
          );
        })}
      </div>
    );
  };

  const renderQuestion = (q: AttemptQuestionSnapshotDto, idx: number) => {
    const selected = answers[q.questionId];
    const isConfirmed = confirmedQuestionIds.includes(q.questionId);

    if (isMatch(q.type)) {
      const pairs = [...q.matchPairs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const rights = Array.from(new Set(pairs.map((p) => p.rightText))).sort((a, b) =>
        a.localeCompare(b, "ru"),
      );

      let payload: MatchPairAnswer[] = [];
      try {
        payload = selected
          ? (JSON.parse(selected) as MatchPairAnswer[])
          : (JSON.parse(initMatchPayloadEmpty(q)) as MatchPairAnswer[]);
        if (!Array.isArray(payload)) payload = [];
      } catch {
        payload = [];
      }

      const rightByLeft = new Map(payload.map((p) => [p.left, p.right]));
      const used = new Set(payload.map((p) => p.right).filter(Boolean));

      const optionsFor = (currentValue: string) => {
        return rights.filter((r) => r === currentValue || !used.has(r));
      };

      return (
        <div key={q.questionId} className="rounded-2xl border border-subtle bg-app p-3">
          <div className="font-medium text-default">
            {idx + 1}. {q.prompt}
          </div>

          <div className="mt-3 space-y-2">
            {pairs.map((p) => {
              const value = rightByLeft.get(p.leftText) ?? "";
              return (
                <div key={p.leftText} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-default">{p.leftText}</div>

                  <select
                    className="w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-sm text-default sm:max-w-xs"
                    value={value}
                    disabled={isConfirmed}
                    onChange={(e) => setMatchRight(q, p.leftText, e.target.value)}
                  >
                    <option value="" disabled hidden />

                    {optionsFor(value).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {renderQuestionExplanation(q, selected, isConfirmed)}
        </div>
      );
    }

    if (isMulti(q.type)) {
      let current: string[] = [];
      try {
        current = selected ? (JSON.parse(selected) as string[]) : [];
        if (!Array.isArray(current)) current = [];
      } catch {
        current = [];
      }
      const set = new Set(current);
      const opts = [...q.options].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      return (
        <div key={q.questionId} className="rounded-2xl border border-subtle bg-app p-3">
          <div className="font-medium text-default">
            {idx + 1}. {q.prompt}
          </div>

          <div className="mt-2 space-y-2">
            {opts.map((o) => (
              <label key={o.text} className="flex items-center gap-2 text-sm text-default">
                <input
                  type="checkbox"
                  checked={set.has(o.text)}
                  disabled={isConfirmed}
                  onChange={(e) => setMultiAnswer(q, o.text, e.target.checked)}
                />
                {o.text}
              </label>
            ))}
          </div>

          {renderQuestionExplanation(q, selected, isConfirmed)}
        </div>
      );
    }

    if (q.type === "FILL_SELECT" && q.blanks.length > 0) {
      let current: FillBlankAnswer[] = [];
      try {
        current = selected ? (JSON.parse(selected) as FillBlankAnswer[]) : [];
        if (!Array.isArray(current)) current = [];
      } catch {
        current = [];
      }

      const byIndex = new Map(current.map((x) => [x.blankIndex, x.value]));
      const hasTemplateTokens = /\{\{\d+\}\}/.test(q.prompt);

      return (
        <div key={q.questionId} className="rounded-2xl border border-subtle bg-app p-3">
          {hasTemplateTokens ? (
            renderInlineFillPrompt(q, byIndex, isConfirmed)
          ) : (
            <>
              <div className="font-medium text-default">
                {idx + 1}. {q.prompt}
              </div>

              <div className="mt-3 space-y-3">
                {[...q.blanks]
                  .sort((a, b) => a.blankIndex - b.blankIndex)
                  .map((b) => (
                    <div key={b.blankIndex}>
                      <div className="mb-1 text-sm text-muted">Пропуск {b.blankIndex}</div>
                      <select
                        className="w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-sm text-default"
                        value={byIndex.get(b.blankIndex) ?? ""}
                        disabled={isConfirmed}
                        onChange={(e) => setFillSelectAnswer(q, b.blankIndex, e.target.value)}
                      >
                        <option value="" disabled>
                          Выберите вариант
                        </option>
                        {b.options.map((o) => (
                          <option key={o.text} value={o.text}>
                            {o.text}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            </>
          )}

          {renderQuestionExplanation(q, selected, isConfirmed)}
        </div>
      );
    }

    if (isSingleLike(q.type)) {
      let current: string | null = null;
      try {
        current = selected ? (JSON.parse(selected) as string) : null;
      } catch {
        current = null;
      }
      const opts = [...q.options].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      return (
        <div key={q.questionId} className="rounded-2xl border border-subtle bg-app p-3">
          <div className="font-medium text-default">
            {idx + 1}. {q.prompt}
          </div>

          <div className="mt-2 space-y-2">
            {opts.map((o) => (
              <label key={o.text} className="flex items-center gap-2 text-sm text-default">
                <input
                  type="radio"
                  name={`q-${q.questionId}`}
                  checked={current === o.text}
                  disabled={isConfirmed}
                  onChange={() => setSingleAnswer(q, o.text)}
                />
                {o.text}
              </label>
            ))}
          </div>

          {renderQuestionExplanation(q, selected, isConfirmed)}
        </div>
      );
    }

    return (
      <div key={q.questionId} className="rounded-2xl border border-subtle bg-app p-3">
        <div className="font-medium text-default">
          {idx + 1}. {q.prompt}
        </div>
        <div className="mt-1 text-sm text-amber-700">Этот тип вопроса пока не поддержан на фронте.</div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={breadcrumbItems} />

      <h2 className="text-2xl font-semibold text-default">Прохождение теста</h2>

      {loading && <LoadingState label="Запускаем тест…" />}
      {error && <ErrorState message={error} onRetry={loadAttempt} />}

      {attempt && !loading && (
        <Card className="space-y-4">
          <div className="sticky top-0 z-10 -mx-4 border-b border-subtle bg-surface px-4 py-3">
            <div className="text-lg font-semibold text-default">{attempt.exam.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span>
                Вопрос {Math.min(currentIndex + 1, attempt.questions.length)} / {attempt.questions.length}
              </span>
              {remainingSec != null && <span>Осталось: {formatRemainingTime(remainingSec)}</span>}
            </div>
            {attempt.exam.description && <div className="mt-1 text-sm text-muted">{attempt.exam.description}</div>}
          </div>

          {!result && currentQuestion && <div className="space-y-3">{renderQuestion(currentQuestion, currentIndex)}</div>}
          {!result && questionError && <div className="text-sm text-rose-600">{questionError}</div>}
          {!result && timeExpired && <div className="text-sm text-rose-600">Время вышло, завершаем тест…</div>}

          {!result && (
            <div className="flex flex-wrap gap-2">
              {!isCurrentQuestionConfirmed ? (
                <Button
                  onClick={confirmCurrentAnswer}
                  isLoading={submitting}
                  disabled={submitting || timeExpired || !!currentQuestionError}
                >
                  Отправить ответ
                </Button>
              ) : (
                <Button onClick={goToNext} isLoading={submitting} disabled={submitting || timeExpired}>
                  {currentIndex === attempt.questions.length - 1 ? "Завершить тест" : "Далее"}
                </Button>
              )}

              <Button variant="outline" onClick={handleExit}>
                К списку
              </Button>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div
                className={`rounded-2xl p-3 text-sm ${
                  result.passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                }`}
              >
                {result.passed ? "Поздравляем! Тест пройден." : "Тест не пройден."} Результат:{" "}
                {result.scorePercent}%.
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => navigate(backRoute)}>Завершить</Button>
                <Button variant="outline" onClick={loadAttempt}>
                  Повторить
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

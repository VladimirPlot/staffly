// D:\staffly\frontend\staffly-frontend\src\features\training\pages\ExamRunPage.tsx
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
type PersistedExamRunState = { attemptId: number; answers: Record<number, string>; currentIndex: number };

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

export default function ExamRunPage() {
  const { examId, folderId } = useParams<{ examId: string; folderId?: string }>();
  const parsedExamId = Number(examId);
  const parsedFolderId = folderId ? Number(folderId) : null;
  const origin = Number.isFinite(parsedFolderId) ? "knowledge" : "exams";
  const navigate = useNavigate();
  const { restaurantId } = useTrainingAccess();

  const [attempt, setAttempt] = useState<ExamAttemptDto | null>(null);

  // answers[questionId] = JSON string (answerJson)
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExamSubmitResultDto | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [knowledgeFolders, setKnowledgeFolders] = useState<TrainingFolderDto[]>([]);

  const backRoute = origin === "knowledge" && parsedFolderId != null ? `${trainingRoutes.knowledge}/${parsedFolderId}` : trainingRoutes.exams;
  const breadcrumbItems = useMemo(() => buildExamRunBreadcrumbs(origin, parsedFolderId, knowledgeFolders), [origin, parsedFolderId, knowledgeFolders]);

  useEffect(() => {
    if (!restaurantId || origin !== "knowledge") return;
    void listFolders(restaurantId, "KNOWLEDGE", false).then(setKnowledgeFolders).catch(() => setKnowledgeFolders([]));
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
        setCurrentIndex(Math.min(Math.max(persisted.currentIndex ?? 0, 0), Math.max(response.questions.length - 1, 0)));
      } else {
        localStorage.removeItem(storageKey);
        setAnswers({});
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
      JSON.stringify({ attemptId: attempt.attemptId, answers, currentIndex }),
    );
  }, [answers, attempt, currentIndex, parsedExamId, result]);

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

  // MATCH: по умолчанию — ПУСТО (без подстановки правильных rightText)
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

  const canGoNext = !submitting && !timeExpired && !currentQuestionError;
  const hasUnsavedAnswers = !result && Object.keys(answers).length > 0;

  const setSingleAnswer = (q: AttemptQuestionSnapshotDto, value: string) => {
    setQuestionError(null);
    setAnswers((prev) => ({ ...prev, [q.questionId]: JSON.stringify(value) }));
  };

  const setMultiAnswer = (q: AttemptQuestionSnapshotDto, value: string, checked: boolean) => {
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

    // enforce unique rights
    const usedRights = new Set(payload.filter((p) => p.left !== left).map((p) => p.right).filter(Boolean));
    if (right && usedRights.has(right)) return;

    const next = payload.map((p) => (p.left === left ? { ...p, right } : p));
    setAnswers((prev) => ({ ...prev, [q.questionId]: JSON.stringify(next) }));
  };

  const setFillSelectAnswer = (q: AttemptQuestionSnapshotDto, blankIndex: number, value: string) => {
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

  // ---- validation before submit (чтобы не отправлять "null" и не ловить 400) ----
  const validateAllAnswered = useCallback((examAttempt: ExamAttemptDto) => {
    for (const q of examAttempt.questions) {
      const validationError = getQuestionValidationError(q, answers[q.questionId]);
      if (validationError) return "Ответьте на все вопросы перед отправкой.";
    }

    return null;
  }, [answers]);

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

  const goToNext = () => {
    if (!attempt || !currentQuestion) return;
    setQuestionError(null);

    const validationError = getQuestionValidationError(currentQuestion, answers[currentQuestion.questionId]);
    if (validationError) {
      setQuestionError("Ответьте на вопрос, чтобы продолжить.");
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

  const renderQuestion = (q: AttemptQuestionSnapshotDto, idx: number) => {
    const selected = answers[q.questionId];

    // MATCH
    if (isMatch(q.type)) {
      const pairs = [...q.matchPairs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const rights = Array.from(new Set(pairs.map((p) => p.rightText))).sort((a, b) => a.localeCompare(b, "ru"));

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
          <div className="font-medium">
            {idx + 1}. {q.prompt}
          </div>
          {q.explanation && <div className="mt-1 text-sm text-muted">{q.explanation}</div>}

          <div className="mt-3 space-y-2">
            {pairs.map((p) => {
              const value = rightByLeft.get(p.leftText) ?? "";
              return (
                <div key={p.leftText} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">{p.leftText}</div>

                  <select
                    className="w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-sm text-default sm:max-w-xs"
                    value={value}
                    onChange={(e) => setMatchRight(q, p.leftText, e.target.value)}
                  >
                    <option value="" disabled>
                      Выберите...
                    </option>

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
        </div>
      );
    }

    // MULTI
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
          <div className="font-medium">
            {idx + 1}. {q.prompt}
          </div>
          {q.explanation && <div className="mt-1 text-sm text-muted">{q.explanation}</div>}

          <div className="mt-2 space-y-2">
            {opts.map((o) => (
              <label key={o.text} className="flex items-center gap-2 text-sm text-default">
                <input
                  type="checkbox"
                  checked={set.has(o.text)}
                  onChange={(e) => setMultiAnswer(q, o.text, e.target.checked)}
                />
                {o.text}
              </label>
            ))}
          </div>
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
      const blanks = [...q.blanks].sort((a, b) => a.blankIndex - b.blankIndex);

      return (
        <div key={q.questionId} className="rounded-2xl border border-subtle bg-app p-3">
          <div className="font-medium">
            {idx + 1}. {q.prompt}
          </div>
          {q.explanation && <div className="mt-1 text-sm text-muted">{q.explanation}</div>}

          <div className="mt-3 space-y-3">
            {blanks.map((b) => (
              <div key={b.blankIndex}>
                <div className="mb-1 text-sm text-muted">Пропуск {b.blankIndex}</div>
                <select
                  className="w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-sm"
                  value={byIndex.get(b.blankIndex) ?? ""}
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
        </div>
      );
    }

    // SINGLE / TRUE_FALSE
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
          <div className="font-medium">
            {idx + 1}. {q.prompt}
          </div>
          {q.explanation && <div className="mt-1 text-sm text-muted">{q.explanation}</div>}

          <div className="mt-2 space-y-2">
            {opts.map((o) => (
              <label key={o.text} className="flex items-center gap-2 text-sm text-default">
                <input
                  type="radio"
                  name={`q-${q.questionId}`}
                  checked={current === o.text}
                  onChange={() => setSingleAnswer(q, o.text)}
                />
                {o.text}
              </label>
            ))}
          </div>
        </div>
      );
    }

    // fallback
    return (
      <div key={q.questionId} className="rounded-2xl border border-subtle bg-app p-3">
        <div className="font-medium">
          {idx + 1}. {q.prompt}
        </div>
        <div className="mt-1 text-sm text-amber-700">Этот тип вопроса пока не поддержан на фронте.</div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={breadcrumbItems} />

      <h2 className="text-2xl font-semibold">Прохождение теста</h2>

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
              <Button onClick={goToNext} isLoading={submitting} disabled={!canGoNext}>
                {currentIndex === attempt.questions.length - 1 ? "Завершить" : "Далее"}
              </Button>
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
                {result.passed ? "Поздравляем! Тест пройден." : "Тест не пройден."} Результат: {" "}
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

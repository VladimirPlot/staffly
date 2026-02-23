import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import { startExam, submitExamAttempt } from "../api/trainingApi";
import type {
  AttemptQuestionSnapshotDto,
  ExamAttemptDto,
  ExamSubmitResultDto,
  TrainingQuestionType,
} from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

type MatchPairAnswer = { left: string; right: string };

function isMulti(type: TrainingQuestionType) {
  return type === "MULTI";
}
function isMatch(type: TrainingQuestionType) {
  return type === "MATCH";
}
function isSingleLike(type: TrainingQuestionType) {
  return type === "SINGLE" || type === "TRUE_FALSE" || type === "FILL_SELECT";
}

export default function ExamRunPage() {
  const { examId } = useParams<{ examId: string }>();
  const parsedExamId = Number(examId);
  const navigate = useNavigate();
  const { restaurantId } = useTrainingAccess();

  const [attempt, setAttempt] = useState<ExamAttemptDto | null>(null);

  // answers[questionId] = JSON string (answerJson)
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExamSubmitResultDto | null>(null);

  const loadAttempt = async () => {
    if (!restaurantId || Number.isNaN(parsedExamId)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await startExam(restaurantId, parsedExamId);
      setAttempt(response);
      setAnswers({});
      setResult(null);
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

  const answeredCount = useMemo(() => {
    if (!attempt) return 0;
    return attempt.questions.filter((q) => typeof answers[q.questionId] === "string").length;
  }, [attempt, answers]);

  const setSingleAnswer = (q: AttemptQuestionSnapshotDto, value: string) => {
    setAnswers((prev) => ({ ...prev, [q.questionId]: JSON.stringify(value) }));
  };

  const setMultiAnswer = (q: AttemptQuestionSnapshotDto, value: string, checked: boolean) => {
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

  const initMatchAnswer = (q: AttemptQuestionSnapshotDto) => {
    // default: one-to-one by sortOrder
    const pairs = [...q.matchPairs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const rights = pairs.map((p) => p.rightText);
    const payload: MatchPairAnswer[] = pairs.map((p, i) => ({ left: p.leftText, right: rights[i] ?? "" }));
    return JSON.stringify(payload);
  };

  const setMatchRight = (q: AttemptQuestionSnapshotDto, left: string, right: string) => {
    let payload: MatchPairAnswer[] = [];
    try {
      payload = answers[q.questionId]
        ? (JSON.parse(answers[q.questionId]) as MatchPairAnswer[])
        : (JSON.parse(initMatchAnswer(q)) as MatchPairAnswer[]);
      if (!Array.isArray(payload)) payload = [];
    } catch {
      payload = [];
    }

    // enforce unique rights (как в backend validate)
    const usedRights = new Set(payload.filter((p) => p.left !== left).map((p) => p.right));
    if (usedRights.has(right)) {
      // если право уже занято — просто не даём поставить
      return;
    }

    const next = payload.map((p) => (p.left === left ? { ...p, right } : p));
    setAnswers((prev) => ({ ...prev, [q.questionId]: JSON.stringify(next) }));
  };

  const submit = async () => {
    if (!restaurantId || !attempt) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await submitExamAttempt(restaurantId, attempt.attemptId, {
        answers: attempt.questions.map((q) => {
          const answerJson = answers[q.questionId];
          return { questionId: q.questionId, answerJson: answerJson ?? "null" };
        }),
      });
      setResult(response);
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось отправить ответы."));
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (q: AttemptQuestionSnapshotDto, idx: number) => {
    const selected = answers[q.questionId];

    // MATCH
    if (isMatch(q.type)) {
      const pairs = [...q.matchPairs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const rights = Array.from(new Set(pairs.map((p) => p.rightText))).sort((a, b) => a.localeCompare(b, "ru"));

      let payload: MatchPairAnswer[] = [];
      try {
        payload = selected ? (JSON.parse(selected) as MatchPairAnswer[]) : (JSON.parse(initMatchAnswer(q)) as MatchPairAnswer[]);
        if (!Array.isArray(payload)) payload = [];
      } catch {
        payload = [];
      }

      const rightByLeft = new Map(payload.map((p) => [p.left, p.right]));

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
                    {rights.map((r) => (
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

    // SINGLE / TRUE_FALSE / FILL_SELECT
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

    // fallback (should not happen)
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
      <Breadcrumbs
        items={[
          { label: "Тренинг", to: trainingRoutes.landing },
          { label: "Аттестации", to: trainingRoutes.exams },
          { label: "Прохождение" },
        ]}
      />

      <h2 className="text-2xl font-semibold">Прохождение аттестации</h2>

      {loading && <LoadingState label="Запускаем аттестацию…" />}
      {error && <ErrorState message={error} onRetry={loadAttempt} />}

      {attempt && !loading && (
        <Card className="space-y-4">
          <div className="space-y-1">
            <div className="text-lg font-semibold text-default">{attempt.exam.title}</div>
            {attempt.exam.description && <div className="text-sm text-muted">{attempt.exam.description}</div>}
          </div>

          <div className="text-sm text-muted">
            Вопросов: {attempt.questions.length}. Отвечено: {answeredCount}.
            {attempt.exam.timeLimitSec ? ` · Лимит: ${attempt.exam.timeLimitSec} сек.` : ""}
          </div>

          <div className="space-y-3">{attempt.questions.map(renderQuestion)}</div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} isLoading={submitting}>
              Отправить ответы
            </Button>
            <Button variant="outline" onClick={() => navigate(trainingRoutes.exams)}>
              К списку аттестаций
            </Button>
          </div>

          {result && (
            <div className={`rounded-2xl p-3 text-sm ${result.passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {result.passed ? "Поздравляем! Аттестация сдана." : "Аттестация не сдана."} Результат:{" "}
              {result.scorePercent}%.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

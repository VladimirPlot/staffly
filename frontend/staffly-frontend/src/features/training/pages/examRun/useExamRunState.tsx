import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { listFolders, startExam, submitExamAttempt } from "../../api/trainingApi";
import type {
  AttemptQuestionSnapshotDto,
  ExamAttemptDto,
  ExamSubmitResultDto,
  TrainingFolderDto,
} from "../../api/types";
import { buildExamRunBreadcrumbs } from "../../utils/examRunBreadcrumbs";
import { getTrainingErrorMessage } from "../../utils/errors";
import { trainingRoutes } from "../../utils/trainingRoutes";
import {
  getQuestionValidationError,
  parseFillBlankAnswer,
  parseMatchAnswer,
  parseStringArrayAnswer,
} from "./answerUtils";
import {
  readPersistedExamRunState,
  removePersistedExamRunState,
  writePersistedExamRunState,
} from "./storage";
import type { FillBlankAnswer } from "./types";

function formatRemainingTime(totalSec: number) {
  const safeSec = Math.max(0, totalSec);
  const minutes = Math.floor(safeSec / 60).toString().padStart(2, "0");
  const seconds = Math.floor(safeSec % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

type Params = {
  restaurantId?: number;
  examId: number;
  folderId: number | null;
  navigate: NavigateFunction;
};

export function useExamRunState({ restaurantId, examId, folderId, navigate }: Params) {
  const origin = Number.isFinite(folderId) ? "knowledge" : "exams";
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
  const loadRequestSeqRef = useRef(0);
  const submitRequestRef = useRef<Promise<void> | null>(null);
  const finishedAttemptRef = useRef<number | null>(null);

  const backRoute =
    origin === "knowledge" && folderId != null
      ? `${trainingRoutes.knowledge}/${folderId}`
      : trainingRoutes.exams;

  const breadcrumbItems = useMemo(
    () => buildExamRunBreadcrumbs(origin, folderId, knowledgeFolders),
    [folderId, knowledgeFolders, origin],
  );

  useEffect(() => {
    if (!restaurantId || origin !== "knowledge") return;
    void listFolders(restaurantId, "KNOWLEDGE", false)
      .then(setKnowledgeFolders)
      .catch(() => setKnowledgeFolders([]));
  }, [origin, restaurantId]);

  const loadAttempt = useCallback(async () => {
    if (!restaurantId || Number.isNaN(examId)) return;
    const requestSeq = ++loadRequestSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await startExam(restaurantId, examId);
      if (requestSeq !== loadRequestSeqRef.current) {
        return;
      }
      const persisted = readPersistedExamRunState(examId);

      if (persisted && persisted.attemptId === response.attemptId) {
        setAnswers(persisted.answers ?? {});
        setCurrentIndex(
          Math.min(Math.max(persisted.currentIndex ?? 0, 0), Math.max(response.questions.length - 1, 0)),
        );
        setConfirmedQuestionIds(persisted.confirmedQuestionIds ?? []);
      } else {
        removePersistedExamRunState(examId);
        setAnswers({});
        setConfirmedQuestionIds([]);
        setCurrentIndex(0);
        setRemainingSec(null);
      }

      setAttempt(response);
      setQuestionError(null);
      setResult(null);
      setTimeExpired(false);
    } catch (loadError) {
      if (requestSeq !== loadRequestSeqRef.current) {
        return;
      }
      setError(getTrainingErrorMessage(loadError, "Не удалось запустить аттестацию."));
    } finally {
      if (requestSeq === loadRequestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [examId, restaurantId]);

  useEffect(() => {
    void loadAttempt();
  }, [loadAttempt]);

  useEffect(() => {
    if (!attempt || Number.isNaN(examId) || result) return;
    writePersistedExamRunState(examId, {
      attemptId: attempt.attemptId,
      answers,
      currentIndex,
      confirmedQuestionIds,
    });
  }, [answers, attempt, confirmedQuestionIds, currentIndex, examId, result]);

  useEffect(() => {
    if (!attempt || attempt.exam.timeLimitSec == null || result) {
      setRemainingSec(null);
      setTimeExpired(false);
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
      setTimeExpired(false);
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [attempt, result]);

  const currentQuestion = attempt?.questions[currentIndex] ?? null;
  const currentQuestionError = useMemo(
    () => (currentQuestion ? getQuestionValidationError(currentQuestion, answers[currentQuestion.questionId]) : null),
    [answers, currentQuestion],
  );
  const isCurrentQuestionConfirmed = currentQuestion
    ? confirmedQuestionIds.includes(currentQuestion.questionId)
    : false;
  const hasUnsavedAnswers = !result && Object.keys(answers).length > 0;
  const isCertificationExam = attempt?.exam.mode === "CERTIFICATION";
  const resultRoute = isCertificationExam && attempt ? trainingRoutes.examResult(attempt.exam.id) : null;

  const setSingleAnswer = (question: AttemptQuestionSnapshotDto, value: string) => {
    if (confirmedQuestionIds.includes(question.questionId)) return;
    setQuestionError(null);
    setAnswers((current) => ({ ...current, [question.questionId]: JSON.stringify(value) }));
  };

  const setMultiAnswer = (question: AttemptQuestionSnapshotDto, value: string, checked: boolean) => {
    if (confirmedQuestionIds.includes(question.questionId)) return;
    setQuestionError(null);
    const next = new Set(parseStringArrayAnswer(answers[question.questionId]));
    if (checked) next.add(value);
    else next.delete(value);
    setAnswers((current) => ({ ...current, [question.questionId]: JSON.stringify(Array.from(next)) }));
  };

  const setMatchRight = (question: AttemptQuestionSnapshotDto, left: string, right: string) => {
    if (confirmedQuestionIds.includes(question.questionId)) return;
    setQuestionError(null);
    const payload = parseMatchAnswer(answers[question.questionId], question);
    const usedRights = new Set(payload.filter((pair) => pair.left !== left).map((pair) => pair.right).filter(Boolean));
    if (right && usedRights.has(right)) return;
    const next = payload.map((pair) => (pair.left === left ? { ...pair, right } : pair));
    setAnswers((current) => ({ ...current, [question.questionId]: JSON.stringify(next) }));
  };

  const setFillSelectAnswer = (question: AttemptQuestionSnapshotDto, blankIndex: number, value: string) => {
    if (confirmedQuestionIds.includes(question.questionId)) return;
    setQuestionError(null);
    const payload = parseFillBlankAnswer(answers[question.questionId]);
    const next: FillBlankAnswer[] = payload.filter((item) => item.blankIndex !== blankIndex);
    next.push({ blankIndex, value });
    setAnswers((current) => ({ ...current, [question.questionId]: JSON.stringify(next) }));
  };

  const validateAllAnswered = useCallback(
    (examAttempt: ExamAttemptDto) => {
      for (const question of examAttempt.questions) {
        if (getQuestionValidationError(question, answers[question.questionId])) {
          return "Ответьте на все вопросы перед отправкой.";
        }
      }
      return null;
    },
    [answers],
  );

  const submit = useCallback(async (options?: { force?: boolean }) => {
    if (!restaurantId || !attempt || finishedAttemptRef.current === attempt.attemptId) return;
    if (submitRequestRef.current) return submitRequestRef.current;
    if (!options?.force) {
      const validationError = validateAllAnswered(attempt);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    const submitPromise = (async () => {
      setSubmitting(true);
      setError(null);
      try {
        const response = await submitExamAttempt(restaurantId, attempt.attemptId, {
          answers: attempt.questions.map((question) => ({
            questionId: question.questionId,
            answerJson: answers[question.questionId] ?? null,
          })),
        });
        finishedAttemptRef.current = attempt.attemptId;
        setResult(response);
        if (!Number.isNaN(examId)) removePersistedExamRunState(examId);
      } catch (submitError) {
        setError(getTrainingErrorMessage(submitError, "Не удалось отправить ответы."));
      } finally {
        setSubmitting(false);
        submitRequestRef.current = null;
      }
    })();
    submitRequestRef.current = submitPromise;
    return submitPromise;
  }, [answers, attempt, examId, restaurantId, validateAllAnswered]);

  useEffect(() => {
    if (!timeExpired || remainingSec !== 0 || !attempt || result || submitting) return;
    void submit({ force: true });
  }, [attempt, remainingSec, result, submit, submitting, timeExpired]);

  useEffect(() => {
    if (!result || !isCertificationExam || !resultRoute) return;
    navigate(resultRoute, { replace: true });
  }, [isCertificationExam, navigate, result, resultRoute]);

  const confirmCurrentAnswer = () => {
    if (!currentQuestion) return;
    setQuestionError(null);
    const validationError = getQuestionValidationError(currentQuestion, answers[currentQuestion.questionId]);
    if (validationError) {
      setQuestionError(validationError);
      return;
    }

    setConfirmedQuestionIds((current) =>
      current.includes(currentQuestion.questionId) ? current : [...current, currentQuestion.questionId],
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
    setCurrentIndex((current) => current + 1);
  };

  const handleExit = () => {
    if (hasUnsavedAnswers) {
      const confirmed = window.confirm("Вы уверены? Прогресс сохранён, можно продолжить позже.");
      if (!confirmed) return;
    }
    navigate(backRoute);
  };

  const renderQuestionExplanation = (question: AttemptQuestionSnapshotDto) => {
    if (!question.explanation) return null;
    const raw = answers[question.questionId];
    const isConfirmed = confirmedQuestionIds.includes(question.questionId);
    if (!isConfirmed || getQuestionValidationError(question, raw)) return null;
    return <div className="mt-3 text-sm text-muted">{question.explanation}</div>;
  };

  return {
    attempt,
    answers,
    breadcrumbItems,
    currentIndex,
    currentQuestion,
    currentQuestionError,
    error,
    formatRemainingTime,
    handleExit,
    isCurrentQuestionConfirmed,
    loading,
    loadAttempt,
    backRoute,
    questionError,
    remainingSec,
    renderQuestionExplanation,
    result,
    resultRoute,
    setFillSelectAnswer,
    setMatchRight,
    setMultiAnswer,
    setSingleAnswer,
    submit,
    submitting,
    timeExpired,
    confirmCurrentAnswer,
    goToNext,
    isCertificationExam,
  };
}

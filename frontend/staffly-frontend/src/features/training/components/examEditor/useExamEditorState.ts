import { useEffect, useMemo, useRef, useState } from "react";
import { listPositions, type PositionDto } from "../../../dictionaries/api";
import {
  createExam,
  createKnowledgeExam,
  listQuestionBankTree,
  listQuestions,
  preflightExamSources,
  updateExam,
} from "../../api/trainingApi";
import type { QuestionBankTreeNodeDto, UpsertExamPayload } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";
import { parseTrainingApiError } from "../../utils/trainingApiError";
import { getManageablePositions } from "../../utils/certificationRoleScope";
import type { ExamEditorProps, ExamEditorFormState } from "./types";
import { allExamAudienceIds, toggleExamAudience } from "./audience";
import {
  buildAvailabilityLabel,
  createTreeHelpers,
  flattenTree,
  normalizeVisibilityForSubmit,
  resolveInitialVisibilityPositionIds,
} from "./utils";

const initialFormState: ExamEditorFormState = {
  title: "",
  description: "",
  passPercent: 80,
  timeLimitSec: "",
  attemptLimit: "",
  visibilityPositionIds: [],
  sourcesFolders: [],
  sourceQuestionIds: [],
  selectedFolderId: null,
  folderQuestions: [],
  query: "",
};

export function useExamEditorState({
  open,
  restaurantId,
  mode,
  exam,
  knowledgeFolderId,
  initialFolderId,
  certificationAllowedAudienceRoles,
  onClose,
  onSaved,
}: ExamEditorProps) {
  const [form, setForm] = useState<ExamEditorFormState>(initialFormState);
  const [tree, setTree] = useState<QuestionBankTreeNodeDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [manageablePositionIds, setManageablePositionIds] = useState<Set<number>>(new Set());
  const [allPositionsSelected, setAllPositionsSelected] = useState(true);
  const [folderVisibilityConfirmation, setFolderVisibilityConfirmation] = useState<{
    payload: UpsertExamPayload;
    warnings: string[];
  } | null>(null);
  const audienceInitialized = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requireRecertification, setRequireRecertification] = useState(false);
  const [staleConflict, setStaleConflict] = useState(false);
  const [newCycleConfirmation, setNewCycleConfirmation] = useState<{
    metadata: Record<string, unknown>;
    payload: UpsertExamPayload;
  } | null>(null);
  const [positionMenuOpen, setPositionMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [sourceIssues, setSourceIssues] = useState<string[]>([]);
  const [sourcePreflightLoading, setSourcePreflightLoading] = useState(false);
  const [treeLoading, setTreeLoading] = useState(false);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [dataRetry, setDataRetry] = useState(0);
  const [questionsRetry, setQuestionsRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    audienceInitialized.current = false;
    setPositions([]);
    setManageablePositionIds(new Set());
    setAllPositionsSelected(mode === "PRACTICE" ? !exam?.visibilityPositionIds.length : !exam);
    setForm({
      title: exam?.title ?? "",
      description: exam?.description ?? "",
      passPercent: exam?.passPercent ?? 80,
      timeLimitSec: exam?.timeLimitSec ?? "",
      attemptLimit: exam?.attemptLimit ?? "",
      visibilityPositionIds: exam?.visibilityPositionIds ?? [],
      sourcesFolders: exam?.sourcesFolders ?? [],
      sourceQuestionIds: exam?.sourceQuestionIds ?? [],
      selectedFolderId: null,
      folderQuestions: [],
      query: "",
    });
    setError(null);
    setStaleConflict(false);
    setNewCycleConfirmation(null);
    setFolderVisibilityConfirmation(null);
    setRequireRecertification(false);
    setPositionMenuOpen(false);
  }, [open, exam, mode, restaurantId]);

  useEffect(() => {
    if (!open) return;

    const media = window.matchMedia("(min-width: 640px)");
    const apply = () => setIsDesktop(media.matches);
    apply();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    media.addListener(apply);
    return () => media.removeListener(apply);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTreeLoading(true);
    setPositionsLoading(true);
    setTreeError(null);
    setPositionsError(null);
    void listQuestionBankTree(restaurantId, mode, false)
      .then((value) => {
        if (!cancelled) setTree(value);
      })
      .catch((error) => {
        if (!cancelled) setTreeError(getTrainingErrorMessage(error, "Не удалось загрузить папки банка вопросов."));
      })
      .finally(() => {
        if (!cancelled) setTreeLoading(false);
      });

    void listPositions(restaurantId, { includeInactive: mode === "CERTIFICATION" && exam != null })
      .then((restaurantPositions) => {
        if (cancelled) return;
        const manageable =
          mode === "CERTIFICATION"
            ? getManageablePositions(restaurantPositions, certificationAllowedAudienceRoles ?? [])
            : restaurantPositions;
        const manageableIds = new Set(manageable.map(({ id }) => id));
        const referencedIds = new Set(exam?.visibilityPositionIds ?? []);
        setManageablePositionIds(manageableIds);
        const visiblePositions =
          mode === "CERTIFICATION"
            ? restaurantPositions.filter(
                (position) => (position.active && manageableIds.has(position.id)) || referencedIds.has(position.id),
              )
            : restaurantPositions;
        setPositions(visiblePositions);
        if (!audienceInitialized.current) {
          audienceInitialized.current = true;
          const ids = resolveInitialVisibilityPositionIds(
            mode,
            exam?.visibilityPositionIds,
            visiblePositions
              .filter((position) => position.active && manageableIds.has(position.id))
              .map((position) => position.id),
          );
          setForm((current) => ({ ...current, visibilityPositionIds: ids }));
          const allIds = allExamAudienceIds(visiblePositions, manageableIds, ids);
          setAllPositionsSelected(
            mode === "PRACTICE"
              ? ids.length === 0
              : ids.length > 0 && ids.length === allIds.length && allIds.every((id) => ids.includes(id)),
          );
        }
      })
      .catch((error) => {
        if (!cancelled) setPositionsError(getTrainingErrorMessage(error, "Не удалось загрузить должности."));
      })
      .finally(() => {
        if (!cancelled) setPositionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [certificationAllowedAudienceRoles, exam, open, restaurantId, mode, dataRetry]);

  useEffect(() => {
    if (!open || !form.selectedFolderId) {
      setQuestionsLoading(false);
      setQuestionsError(null);
      return;
    }
    let cancelled = false;
    setQuestionsLoading(true);
    setQuestionsError(null);
    setForm((current) => ({ ...current, folderQuestions: [] }));
    const group = mode === "PRACTICE" ? "PRACTICE" : "CERTIFICATION";

    void listQuestions(restaurantId, form.selectedFolderId, false, form.query || undefined, group)
      .then((folderQuestions) => {
        if (!cancelled) setForm((current) => ({ ...current, folderQuestions }));
      })
      .catch((error) => {
        if (!cancelled) setQuestionsError(getTrainingErrorMessage(error, "Не удалось загрузить вопросы."));
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.query, form.selectedFolderId, mode, open, restaurantId, questionsRetry]);

  const folderSourceMap = useMemo(
    () => new Map(form.sourcesFolders.map((source) => [source.folderId, source])),
    [form.sourcesFolders],
  );

  const flatTree = useMemo(() => flattenTree(tree), [tree]);
  const { folderMetaMap, getAncestorIds, getDescendantIds } = useMemo(() => createTreeHelpers(flatTree), [flatTree]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSourcePreflightLoading(true);
    setTotalQuestions(0);

    const timer = window.setTimeout(() => {
      void preflightExamSources(restaurantId, {
        mode,
        sourcesFolders: form.sourcesFolders,
        sourceQuestionIds: form.sourceQuestionIds,
      })
        .then((result) => {
          if (cancelled) return;
          setTotalQuestions(result.availableQuestionCount);
          setSourceIssues(result.issues);
        })
        .catch((preflightError) => {
          if (cancelled) return;
          setTotalQuestions(0);
          setSourceIssues([getTrainingErrorMessage(preflightError, "Не удалось проверить источники вопросов.")]);
        })
        .finally(() => {
          if (!cancelled) setSourcePreflightLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.sourceQuestionIds, form.sourcesFolders, mode, open, restaurantId]);

  const availabilityLabel = useMemo(
    () => buildAvailabilityLabel(mode, form.visibilityPositionIds, positions, isDesktop, allPositionsSelected),
    [mode, form.visibilityPositionIds, positions, isDesktop, allPositionsSelected],
  );

  const togglePosition = (positionId: number) => {
    if (positionsLoading) return;
    const selection = toggleExamAudience(
      mode,
      allPositionsSelected,
      form.visibilityPositionIds,
      positionId,
      positions,
      manageablePositionIds,
    );
    setAllPositionsSelected(selection.allSelected);
    setForm((current) => ({ ...current, visibilityPositionIds: selection.ids }));
  };

  const handleSelectAllPositions = () => {
    if (positionsLoading) return;
    setAllPositionsSelected(true);
    setForm((current) => ({
      ...current,
      visibilityPositionIds:
        mode === "CERTIFICATION"
          ? allExamAudienceIds(positions, manageablePositionIds, current.visibilityPositionIds)
          : [],
    }));
  };

  const toggleFolder = (folderId: number) => {
    const alreadySelected = folderSourceMap.has(folderId);

    if (alreadySelected) {
      setForm((current) => ({
        ...current,
        sourcesFolders: current.sourcesFolders.filter((source) => source.folderId !== folderId),
      }));
      setError(null);
      return;
    }

    const selectedFolderIds = new Set(form.sourcesFolders.map((source) => source.folderId));
    const ancestorSelected = getAncestorIds(folderId).find((id) => selectedFolderIds.has(id));
    if (ancestorSelected != null) {
      const parentName = folderMetaMap.get(ancestorSelected)?.name ?? "родительская папка";
      setError(`Нельзя добавить эту папку, потому что уже выбрана родительская папка "${parentName}".`);
      return;
    }

    const descendantSelected = getDescendantIds(folderId).find((id) => selectedFolderIds.has(id));
    if (descendantSelected != null) {
      const childName = folderMetaMap.get(descendantSelected)?.name ?? "вложенная папка";
      setError(`Нельзя добавить эту папку, потому что уже выбрана вложенная папка "${childName}".`);
      return;
    }

    setForm((current) => {
      const next = {
        ...current,
        sourcesFolders: [...current.sourcesFolders, { folderId, pickMode: "ALL" as const }],
      };

      if (current.selectedFolderId !== folderId) {
        return next;
      }

      return {
        ...next,
        sourceQuestionIds: current.sourceQuestionIds.filter(
          (id) => !current.folderQuestions.some((question) => question.id === id),
        ),
      };
    });

    setError(null);
  };

  const updateFolderPickMode = (folderId: number, value: "ALL" | "RANDOM") => {
    setForm((current) => ({
      ...current,
      sourcesFolders: current.sourcesFolders.map((source) =>
        source.folderId === folderId
          ? {
              ...source,
              pickMode: value,
              randomCount: value === "RANDOM" ? Math.max(1, Number(source.randomCount ?? 1)) : null,
            }
          : source,
      ),
    }));
  };

  const updateFolderRandomCount = (folderId: number, value: number) => {
    setForm((current) => ({
      ...current,
      sourcesFolders: current.sourcesFolders.map((source) =>
        source.folderId === folderId ? { ...source, randomCount: Math.max(1, value) } : source,
      ),
    }));
  };

  const toggleQuestion = (questionId: number) => {
    setForm((current) => ({
      ...current,
      sourceQuestionIds: current.sourceQuestionIds.includes(questionId)
        ? current.sourceQuestionIds.filter((id) => id !== questionId)
        : [...current.sourceQuestionIds, questionId],
    }));
  };

  const persistPayload = async (payload: UpsertExamPayload) => {
    setSaving(true);
    setError(null);
    let attemptedUpdatePayload: UpsertExamPayload | null = null;
    try {
      if (exam) {
        attemptedUpdatePayload = {
          ...payload,
          active: exam.active,
          expectedEditorRevision: exam.editorRevision,
          confirmNewVersion: false,
        };
        await updateExam(restaurantId, exam.id, attemptedUpdatePayload);
      } else if (mode === "PRACTICE") {
        await createKnowledgeExam(restaurantId, payload);
      } else {
        await createExam(restaurantId, payload);
      }

      await onSaved();
      onClose();
    } catch (submitError) {
      const parsedError = parseTrainingApiError(submitError);
      if (exam && parsedError.payload?.error === "STALE_EXAM_REVISION") {
        setNewCycleConfirmation(null);
        setStaleConflict(true);
        setError("Тест уже изменён другим пользователем. Обновите данные перед сохранением.");
      } else if (exam && parsedError.payload?.error === "MATERIAL_CHANGE_REQUIRES_NEW_CYCLE") {
        if (attemptedUpdatePayload) {
          setNewCycleConfirmation({
            metadata: parsedError.payload.meta ?? {},
            payload: attemptedUpdatePayload,
          });
          setRequireRecertification(false);
        }
        setError(null);
      } else {
        setError(getTrainingErrorMessage(submitError, "Не удалось сохранить тест."));
      }
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (saving || treeLoading || positionsLoading || treeError || positionsError) return;
    if (!form.title.trim()) {
      setError("Название обязательно.");
      return;
    }

    if (mode === "CERTIFICATION" && form.attemptLimit === "") {
      setError("Для аттестации лимит попыток обязателен.");
      return;
    }

    if (mode === "CERTIFICATION" && form.visibilityPositionIds.length === 0) {
      setError("Для аттестации нужно выбрать хотя бы одну должность в блоке видимости.");
      return;
    }

    if (form.sourcesFolders.length === 0 && form.sourceQuestionIds.length === 0) {
      setError("Добавьте хотя бы один источник вопросов.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const preflight = await preflightExamSources(restaurantId, {
        mode,
        sourcesFolders: form.sourcesFolders,
        sourceQuestionIds: form.sourceQuestionIds,
        knowledgeFolderId: mode === "PRACTICE" ? (knowledgeFolderId ?? exam?.knowledgeFolderId ?? null) : null,
        folderId: mode === "CERTIFICATION" ? (exam ? (exam.folderId ?? null) : (initialFolderId ?? null)) : null,
        visibilityPositionIds: normalizeVisibilityForSubmit(mode, form.visibilityPositionIds),
      });
      if (!preflight.valid || preflight.availableQuestionCount <= 0) {
        setSourceIssues(preflight.issues);
        setError(preflight.issues[0] ?? "В тесте должен быть хотя бы один доступный вопрос.");
        return;
      }
      const authoritativeQuestionCount = preflight.availableQuestionCount;
      const payload: UpsertExamPayload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        mode,
        knowledgeFolderId: mode === "PRACTICE" ? (knowledgeFolderId ?? exam?.knowledgeFolderId ?? null) : null,
        folderId: mode === "CERTIFICATION" ? (exam ? (exam.folderId ?? null) : (initialFolderId ?? null)) : null,
        questionCount: authoritativeQuestionCount,
        passPercent: form.passPercent,
        timeLimitSec: form.timeLimitSec === "" ? null : Number(form.timeLimitSec),
        attemptLimit: form.attemptLimit === "" ? null : Number(form.attemptLimit),
        visibilityPositionIds: [...normalizeVisibilityForSubmit(mode, form.visibilityPositionIds)],
        sourcesFolders: form.sourcesFolders.map((source) => ({ ...source })),
        sourceQuestionIds: [...form.sourceQuestionIds],
      };

      const warnings = preflight.folderVisibilityWarnings ?? [];
      if (warnings.length > 0) {
        setFolderVisibilityConfirmation({ payload, warnings });
        return;
      }
      await persistPayload(payload);
    } catch (preflightError) {
      setError(getTrainingErrorMessage(preflightError, "Не удалось проверить тест перед сохранением."));
    } finally {
      setSaving(false);
    }
  };

  const confirmNewVersion = async () => {
    if (!exam || !newCycleConfirmation) return;

    // This is deliberately not the normal save path: confirmation must submit
    // exactly the full-replace payload that produced the warning, without a new
    // source preflight or a rebuild from possibly changed form state.
    const frozenPayload = newCycleConfirmation.payload;
    setSaving(true);
    setError(null);

    try {
      await updateExam(restaurantId, exam.id, {
        ...frozenPayload,
        confirmNewVersion: true,
        requireRecertification,
      });
      await onSaved();
      onClose();
    } catch (submitError) {
      const parsedError = parseTrainingApiError(submitError);
      setNewCycleConfirmation(null);
      if (parsedError.payload?.error === "STALE_EXAM_REVISION") {
        setStaleConflict(true);
        setError("Тест уже изменён другим пользователем. Обновите данные перед сохранением.");
      } else {
        setError(getTrainingErrorMessage(submitError, "Не удалось сохранить тест."));
      }
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    tree,
    positions,
    manageablePositionIds,
    allPositionsSelected,
    folderVisibilityConfirmation,
    cancelFolderVisibilityConfirmation: () => setFolderVisibilityConfirmation(null),
    confirmFolderVisibility: () => {
      if (!folderVisibilityConfirmation || saving) return;
      const payload = folderVisibilityConfirmation.payload;
      setFolderVisibilityConfirmation(null);
      void persistPayload(payload);
    },
    error,
    saving,
    staleConflict,
    refreshAfterConflict: async () => {
      await onSaved();
      onClose();
    },
    positionMenuOpen,
    setPositionMenuOpen,
    isDesktop,
    folderSourceMap,
    folderMetaMap,
    totalQuestions,
    sourceIssues,
    sourcePreflightLoading,
    treeLoading,
    positionsLoading,
    questionsLoading,
    treeError,
    positionsError,
    questionsError,
    retryEditorData: () => setDataRetry((value) => value + 1),
    retryQuestions: () => setQuestionsRetry((value) => value + 1),
    availabilityLabel,
    setTitle: (title: string) => setForm((current) => ({ ...current, title })),
    setDescription: (description: string) => setForm((current) => ({ ...current, description })),
    setPassPercent: (passPercent: number) => setForm((current) => ({ ...current, passPercent })),
    setTimeLimitSec: (timeLimitSec: number | "") => setForm((current) => ({ ...current, timeLimitSec })),
    setAttemptLimit: (attemptLimit: number | "") => setForm((current) => ({ ...current, attemptLimit })),
    setSelectedFolderId: (selectedFolderId: number | null) => setForm((current) => ({ ...current, selectedFolderId })),
    setQuery: (query: string) => setForm((current) => ({ ...current, query })),
    togglePosition,
    handleSelectAllPositions,
    toggleFolder,
    updateFolderPickMode,
    updateFolderRandomCount,
    toggleQuestion,
    submit: () => void save(),
    newCycleConfirmation,
    cancelNewCycleConfirmation: () => setNewCycleConfirmation(null),
    confirmNewVersion: () => void confirmNewVersion(),
    requireRecertification,
    setRequireRecertification,
  };
}

import { useEffect, useMemo, useState } from "react";
import { listPositions, type PositionDto } from "../../../dictionaries/api";
import {
  createExam,
  createKnowledgeExam,
  listQuestionBankTree,
  listQuestions,
  preflightExamSources,
  updateExam,
} from "../../api/trainingApi";
import type { QuestionBankTreeNodeDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";
import { getManageablePositions } from "../../utils/certificationRoleScope";
import type { ExamEditorProps, ExamEditorFormState } from "./types";
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [positionMenuOpen, setPositionMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [sourceIssues, setSourceIssues] = useState<string[]>([]);
  const [sourcePreflightLoading, setSourcePreflightLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

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
    setPositionMenuOpen(false);
  }, [open, exam]);

  useEffect(() => {
    if (!open || positions.length === 0) return;
    const allPositionIds = positions.map((position) => position.id);
    setForm((current) => ({
      ...current,
      visibilityPositionIds: resolveInitialVisibilityPositionIds(mode, current.visibilityPositionIds, allPositionIds),
    }));
  }, [mode, open, positions]);

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

    void listQuestionBankTree(restaurantId, mode, false)
      .then(setTree)
      .catch(() => setTree([]));

    void listPositions(restaurantId, { includeInactive: mode === "CERTIFICATION" && exam != null })
      .then((restaurantPositions) => {
        if (mode !== "CERTIFICATION") {
          setPositions(restaurantPositions);
          setManageablePositionIds(new Set(restaurantPositions.map(({ id }) => id)));
          return;
        }

        const manageable = getManageablePositions(restaurantPositions, certificationAllowedAudienceRoles ?? []);
        const manageableIds = new Set(manageable.map(({ id }) => id));
        const referencedIds = new Set(exam?.visibilityPositionIds ?? []);
        setManageablePositionIds(manageableIds);
        setPositions(
          restaurantPositions.filter(
            (position) => (position.active && manageableIds.has(position.id)) || referencedIds.has(position.id),
          ),
        );
      })
      .catch(() => {
        setPositions([]);
        setManageablePositionIds(new Set());
      });
  }, [certificationAllowedAudienceRoles, exam, open, restaurantId, mode]);

  useEffect(() => {
    if (!open || !form.selectedFolderId) return;
    const group = mode === "PRACTICE" ? "PRACTICE" : "CERTIFICATION";

    void listQuestions(restaurantId, form.selectedFolderId, false, form.query || undefined, group)
      .then((folderQuestions) => setForm((current) => ({ ...current, folderQuestions })))
      .catch(() => setForm((current) => ({ ...current, folderQuestions: [] })));
  }, [form.query, form.selectedFolderId, mode, open, restaurantId]);

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
    () => buildAvailabilityLabel(mode, form.visibilityPositionIds, positions, isDesktop),
    [mode, form.visibilityPositionIds, positions, isDesktop],
  );

  const togglePosition = (positionId: number) => {
    setForm((current) => ({
      ...current,
      visibilityPositionIds: current.visibilityPositionIds.includes(positionId)
        ? manageablePositionIds.has(positionId)
          ? current.visibilityPositionIds.filter((id) => id !== positionId)
          : current.visibilityPositionIds
        : positions.some((position) => position.id === positionId && position.active) &&
            manageablePositionIds.has(positionId)
          ? [...current.visibilityPositionIds, positionId]
          : current.visibilityPositionIds,
    }));
  };

  const handleSelectAllPositions = () => {
    setForm((current) => ({
      ...current,
      visibilityPositionIds:
        mode === "CERTIFICATION"
          ? Array.from(
              new Set([
                ...current.visibilityPositionIds.filter((id) =>
                  positions.some(
                    (position) => position.id === id && (!position.active || !manageablePositionIds.has(position.id)),
                  ),
                ),
                ...positions
                  .filter((position) => position.active && manageablePositionIds.has(position.id))
                  .map((position) => position.id),
              ]),
            )
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

  const submit = async () => {
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
      });
      if (!preflight.valid || preflight.availableQuestionCount <= 0) {
        setSourceIssues(preflight.issues);
        setError(preflight.issues[0] ?? "В тесте должен быть хотя бы один доступный вопрос.");
        return;
      }
      const authoritativeQuestionCount = preflight.availableQuestionCount;
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        mode,
        knowledgeFolderId: mode === "PRACTICE" ? (knowledgeFolderId ?? exam?.knowledgeFolderId ?? null) : null,
        folderId: mode === "CERTIFICATION" ? (exam ? (exam.folderId ?? null) : (initialFolderId ?? null)) : null,
        questionCount: authoritativeQuestionCount,
        passPercent: form.passPercent,
        timeLimitSec: form.timeLimitSec === "" ? null : Number(form.timeLimitSec),
        attemptLimit: form.attemptLimit === "" ? null : Number(form.attemptLimit),
        visibilityPositionIds: normalizeVisibilityForSubmit(mode, form.visibilityPositionIds),
        sourcesFolders: form.sourcesFolders,
        sourceQuestionIds: form.sourceQuestionIds,
      };

      if (exam) {
        await updateExam(restaurantId, exam.id, { ...payload, active: exam.active });
      } else if (mode === "PRACTICE") {
        await createKnowledgeExam(restaurantId, payload);
      } else {
        await createExam(restaurantId, payload);
      }

      await onSaved();
      onClose();
    } catch (submitError) {
      setError(getTrainingErrorMessage(submitError, "Не удалось сохранить тест."));
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    tree,
    positions,
    manageablePositionIds,
    error,
    saving,
    positionMenuOpen,
    setPositionMenuOpen,
    isDesktop,
    folderSourceMap,
    folderMetaMap,
    totalQuestions,
    sourceIssues,
    sourcePreflightLoading,
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
    submit,
  };
}

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import type {
  ExamSourceFolderDto,
  QuestionBankTreeNodeDto,
  TrainingExamDto,
  TrainingExamMode,
  TrainingQuestionDto,
} from "../api/types";
import {
  createExam,
  createKnowledgeExam,
  listQuestionBankTree,
  listQuestions,
  updateExam,
} from "../api/trainingApi";
import { getTrainingErrorMessage } from "../utils/errors";

type Props = {
  open: boolean;
  restaurantId: number;
  mode: TrainingExamMode;
  exam?: TrainingExamDto | null;
  knowledgeFolderId?: number | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

type FlatTreeNode = {
  id: number;
  name: string;
  questionCount: number;
  parentId: number | null;
};

function flattenTree(
  nodes: QuestionBankTreeNodeDto[],
  parentId: number | null = null,
): FlatTreeNode[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      name: node.name,
      questionCount: node.questionCount,
      parentId,
    },
    ...flattenTree(node.children, node.id),
  ]);
}

export default function ExamEditorModal({
  open,
  restaurantId,
  mode,
  exam,
  knowledgeFolderId,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passPercent, setPassPercent] = useState(80);
  const [timeLimitSec, setTimeLimitSec] = useState<number | "">("");
  const [attemptLimit, setAttemptLimit] = useState<number | "">("");
  const [visibilityPositionIds, setVisibilityPositionIds] = useState<number[]>([]);
  const [sourcesFolders, setSourcesFolders] = useState<ExamSourceFolderDto[]>([]);
  const [sourceQuestionIds, setSourceQuestionIds] = useState<number[]>([]);
  const [tree, setTree] = useState<QuestionBankTreeNodeDto[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [folderQuestions, setFolderQuestions] = useState<TrainingQuestionDto[]>([]);
  const [query, setQuery] = useState("");
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [positionMenuOpen, setPositionMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (!open) return;

    setTitle(exam?.title ?? "");
    setDescription(exam?.description ?? "");
    setPassPercent(exam?.passPercent ?? 80);
    setTimeLimitSec(exam?.timeLimitSec ?? "");
    setAttemptLimit(exam?.attemptLimit ?? "");
    setVisibilityPositionIds(exam?.visibilityPositionIds ?? []);
    setSourcesFolders(exam?.sourcesFolders ?? []);
    setSourceQuestionIds(exam?.sourceQuestionIds ?? []);
    setSelectedFolderId(null);
    setFolderQuestions([]);
    setQuery("");
    setError(null);
    setPositionMenuOpen(false);
  }, [open, exam]);

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

    void listPositions(restaurantId, { includeInactive: false })
      .then(setPositions)
      .catch(() => setPositions([]));
  }, [open, restaurantId, mode]);

  useEffect(() => {
    if (!open || !selectedFolderId) return;
    const group = mode === "PRACTICE" ? "PRACTICE" : "CERTIFICATION";

    void listQuestions(restaurantId, selectedFolderId, false, query || undefined, group)
      .then(setFolderQuestions)
      .catch(() => setFolderQuestions([]));
  }, [open, restaurantId, selectedFolderId, mode, query]);

  const folderSourceMap = useMemo(
    () => new Map(sourcesFolders.map((s) => [s.folderId, s])),
    [sourcesFolders],
  );

  const flatTree = useMemo(() => flattenTree(tree), [tree]);

  const folderMetaMap = useMemo(() => {
    return new Map(flatTree.map((node) => [node.id, node]));
  }, [flatTree]);

  const childrenByParentId = useMemo(() => {
    const map = new Map<number, number[]>();
    flatTree.forEach((node) => {
      if (node.parentId == null) return;
      const current = map.get(node.parentId) ?? [];
      current.push(node.id);
      map.set(node.parentId, current);
    });
    return map;
  }, [flatTree]);

  const getAncestorIds = (folderId: number) => {
    const ids: number[] = [];
    let cursor = folderMetaMap.get(folderId) ?? null;
    while (cursor?.parentId != null) {
      ids.push(cursor.parentId);
      cursor = folderMetaMap.get(cursor.parentId) ?? null;
    }
    return ids;
  };

  const getDescendantIds = (folderId: number): number[] => {
    const result: number[] = [];
    const stack = [...(childrenByParentId.get(folderId) ?? [])];

    while (stack.length > 0) {
      const current = stack.pop()!;
      result.push(current);
      const children = childrenByParentId.get(current) ?? [];
      stack.push(...children);
    }

    return result;
  };

  const totalQuestions = useMemo(() => {
    const foldersCount = sourcesFolders.reduce((sum, source) => {
      const folder = folderMetaMap.get(source.folderId);
      if (!folder) return sum;

      if (source.pickMode === "RANDOM") {
        const requested = Math.max(0, Number(source.randomCount ?? 0));
        return sum + Math.min(requested, folder.questionCount);
      }

      return sum + folder.questionCount;
    }, 0);

    return foldersCount + sourceQuestionIds.length;
  }, [folderMetaMap, sourceQuestionIds.length, sourcesFolders]);

  const availabilityLabel = useMemo(() => {
    if (visibilityPositionIds.length === 0) return "Всем сотрудникам";

    const selected = positions.filter((p) => visibilityPositionIds.includes(p.id));
    if (selected.length === 0) return "Всем сотрудникам";

    const visibleCount = isDesktop ? 4 : 2;

    if (selected.length <= visibleCount) {
      return selected.map((p) => p.name).join(", ");
    }

    const visibleNames = selected.slice(0, visibleCount).map((p) => p.name).join(", ");
    return `${visibleNames} +${selected.length - visibleCount}`;
  }, [isDesktop, positions, visibilityPositionIds]);

  const togglePosition = (positionId: number) => {
    setVisibilityPositionIds((prev) =>
      prev.includes(positionId)
        ? prev.filter((id) => id !== positionId)
        : [...prev, positionId],
    );
  };

  const handleSelectAllPositions = () => {
    setVisibilityPositionIds([]);
  };

  const toggleFolder = (folderId: number) => {
    const alreadySelected = folderSourceMap.has(folderId);

    if (alreadySelected) {
      setSourcesFolders((prev) => prev.filter((s) => s.folderId !== folderId));
      setError(null);
      return;
    }

    const selectedFolderIds = new Set(sourcesFolders.map((s) => s.folderId));
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

    setSourcesFolders((prev) => [...prev, { folderId, pickMode: "ALL" }]);

    if (selectedFolderId === folderId) {
      setSourceQuestionIds((prev) =>
        prev.filter((id) => !folderQuestions.some((q) => q.id === id)),
      );
    }

    setError(null);
  };

  const updateFolderPickMode = (folderId: number, value: "ALL" | "RANDOM") => {
    setSourcesFolders((prev) =>
      prev.map((source) =>
        source.folderId === folderId
          ? {
              ...source,
              pickMode: value,
              randomCount:
                value === "RANDOM"
                  ? Math.max(1, Number(source.randomCount ?? 1))
                  : null,
            }
          : source,
      ),
    );
  };

  const updateFolderRandomCount = (folderId: number, value: number) => {
    setSourcesFolders((prev) =>
      prev.map((source) =>
        source.folderId === folderId
          ? { ...source, randomCount: Math.max(1, value) }
          : source,
      ),
    );
  };

  const submit = async () => {
    if (!title.trim()) {
      setError("Название обязательно.");
      return;
    }

    if (mode === "CERTIFICATION" && attemptLimit === "") {
      setError("Для аттестации лимит попыток обязателен.");
      return;
    }

    if (sourcesFolders.length === 0 && sourceQuestionIds.length === 0) {
      setError("Добавьте хотя бы один источник вопросов.");
      return;
    }

    if (totalQuestions <= 0) {
      setError("В тесте должен быть хотя бы один вопрос.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        mode,
        knowledgeFolderId:
          mode === "PRACTICE" ? knowledgeFolderId ?? exam?.knowledgeFolderId ?? null : null,
        questionCount: totalQuestions,
        passPercent,
        timeLimitSec: timeLimitSec === "" ? null : Number(timeLimitSec),
        attemptLimit: attemptLimit === "" ? null : Number(attemptLimit),
        visibilityPositionIds,
        sourcesFolders,
        sourceQuestionIds,
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
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось сохранить тест."));
    } finally {
      setSaving(false);
    }
  };

  const renderNode = (node: QuestionBankTreeNodeDto, level = 0) => {
    const source = folderSourceMap.get(node.id);
    const isCurrentFolderSelectedAsSource = !!source && selectedFolderId === node.id;
    const sourceQuestionCount =
      source?.pickMode === "RANDOM"
        ? Math.min(Math.max(1, Number(source.randomCount ?? 1)), node.questionCount)
        : node.questionCount;

    return (
      <div key={node.id} className="space-y-1">
        <div
          className="rounded-xl border border-subtle bg-app/40 p-2"
          style={{ marginLeft: `${level * 12}px` }}
        >
          <div className="flex flex-wrap items-start gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setSelectedFolderId(node.id)}
            >
              <div className="truncate text-sm font-medium text-default">{node.name}</div>
              <div className="text-xs text-muted">{node.questionCount} вопросов</div>
            </button>

            <label className="flex items-center gap-2 text-sm text-default">
              <input
                type="checkbox"
                checked={!!source}
                onChange={() => toggleFolder(node.id)}
              />
              Добавить
            </label>
          </div>

          {source && (
            <div className="mt-2 space-y-2 rounded-xl bg-surface p-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-default">
                  <input
                    type="radio"
                    name={`pick-mode-${node.id}`}
                    checked={source.pickMode === "ALL"}
                    onChange={() => updateFolderPickMode(node.id, "ALL")}
                  />
                  Все вопросы
                </label>

                <label className="flex items-center gap-2 text-sm text-default">
                  <input
                    type="radio"
                    name={`pick-mode-${node.id}`}
                    checked={source.pickMode === "RANDOM"}
                    onChange={() => updateFolderPickMode(node.id, "RANDOM")}
                  />
                  Случайные
                </label>

                {source.pickMode === "RANDOM" && (
                  <input
                    className="h-9 w-24 rounded-xl border border-subtle bg-surface px-3 text-sm text-default"
                    type="number"
                    min={1}
                    max={node.questionCount}
                    value={source.randomCount ?? 1}
                    onChange={(e) => updateFolderRandomCount(node.id, Number(e.target.value))}
                  />
                )}
              </div>

              <div className="text-xs text-muted">
                В тест попадёт: {sourceQuestionCount}
              </div>
            </div>
          )}

          {isCurrentFolderSelectedAsSource && (
            <div className="mt-2 text-xs text-muted">
              Эта папка уже добавлена в тест. Отдельные вопросы из неё выбрать нельзя.
            </div>
          )}
        </div>

        {node.children.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "PRACTICE" ? "Создать тест" : "Создать аттестацию"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} isLoading={saving}>
            {exam ? "Сохранить" : mode === "PRACTICE" ? "Создать тест" : "Создать аттестацию"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="text-sm font-semibold text-default">Основная информация</div>

          <Input
            label="Название теста"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Input
            label="Описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </section>

        <section className="space-y-3">
          <div className="text-sm font-semibold text-default">Правила прохождения</div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Проходной балл, %"
              type="number"
              min={1}
              max={100}
              value={passPercent}
              onChange={(e) => setPassPercent(Number(e.target.value))}
            />

            <Input
              label="Таймер (сек)"
              type="number"
              min={1}
              value={timeLimitSec}
              onChange={(e) =>
                setTimeLimitSec(e.target.value === "" ? "" : Number(e.target.value))
              }
            />

            <Input
              label="Лимит попыток"
              type="number"
              min={1}
              value={attemptLimit}
              onChange={(e) =>
                setAttemptLimit(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-sm font-semibold text-default">Кому доступен тест</div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setPositionMenuOpen((prev) => !prev)}
              className="flex h-11 w-full items-center justify-between rounded-2xl border border-subtle bg-surface px-3 text-left text-sm text-default shadow-[var(--staffly-shadow)] transition hover:bg-app"
            >
              <span>{availabilityLabel}</span>
              <ChevronDown className={`h-4 w-4 transition ${positionMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {positionMenuOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-2xl border border-subtle bg-surface p-2 shadow-lg">
                <button
                  type="button"
                  onClick={handleSelectAllPositions}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-app ${
                    visibilityPositionIds.length === 0 ? "bg-app font-medium" : ""
                  }`}
                >
                  <span>Всем сотрудникам</span>
                  {visibilityPositionIds.length === 0 && <span>✓</span>}
                </button>

                <div className="my-2 border-t border-subtle" />

                <div className="max-h-56 overflow-auto space-y-1">
                  {positions.map((position) => {
                    const checked = visibilityPositionIds.includes(position.id);

                    return (
                      <label
                        key={position.id}
                        className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm text-default transition hover:bg-app"
                      >
                        <span>{position.name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePosition(position.id)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-muted">
            Если не ограничивать доступ по должностям, тест будет доступен всем сотрудникам.
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-sm font-semibold text-default">Вопросы для теста</div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-subtle p-3">
              <div className="text-sm font-medium text-default">Папки банка вопросов</div>
              <div className="max-h-80 space-y-2 overflow-auto">
                {tree.length > 0 ? (
                  tree.map((node) => renderNode(node))
                ) : (
                  <div className="text-sm text-muted">Нет доступных папок.</div>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-subtle p-3">
              <div className="text-sm font-medium text-default">
                {selectedFolderId
                  ? `Вопросы из папки "${folderMetaMap.get(selectedFolderId)?.name ?? ""}"`
                  : "Выберите папку слева"}
              </div>

              <Input
                label="Поиск по вопросам"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!selectedFolderId}
              />

              <div className="max-h-64 space-y-2 overflow-auto">
                {!selectedFolderId && (
                  <div className="text-sm text-muted">
                    Сначала выберите папку, чтобы посмотреть вопросы.
                  </div>
                )}

                {selectedFolderId &&
                  folderQuestions.map((question) => {
                    const disabled = folderSourceMap.has(selectedFolderId);

                    return (
                      <label
                        key={question.id}
                        className={`flex items-start gap-2 rounded-xl px-2 py-2 text-sm ${
                          disabled ? "opacity-60" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={sourceQuestionIds.includes(question.id)}
                          onChange={() =>
                            setSourceQuestionIds((prev) =>
                              prev.includes(question.id)
                                ? prev.filter((id) => id !== question.id)
                                : [...prev, question.id],
                            )
                          }
                        />

                        <div className="min-w-0">
                          <div className="truncate text-default">{question.title}</div>
                          <div className="text-xs text-muted">{question.type}</div>
                        </div>
                      </label>
                    );
                  })}

                {selectedFolderId && folderQuestions.length === 0 && (
                  <div className="text-sm text-muted">В этой папке нет вопросов по текущему фильтру.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-subtle bg-app p-3">
          <div className="text-sm font-semibold text-default">Сводка</div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted">Режим</div>
              <div className="text-sm text-default">
                {mode === "PRACTICE" ? "Учебный тест" : "Аттестация"}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted">Доступ</div>
              <div className="text-sm text-default">{availabilityLabel}</div>
            </div>

            <div>
              <div className="text-xs text-muted">Источники</div>
              <div className="text-sm text-default">
                {sourcesFolders.length} папок · {sourceQuestionIds.length} отдельных вопросов
              </div>
            </div>

            <div>
              <div className="text-xs text-muted">Итого вопросов в тесте</div>
              <div className="text-sm font-semibold text-default">{totalQuestions}</div>
            </div>
          </div>
        </section>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </Modal>
  );
}

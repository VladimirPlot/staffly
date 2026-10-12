import { useState, type ChangeEvent } from "react";
import Modal from "../../../../../shared/ui/Modal";
import Button from "../../../../../shared/ui/Button";
import { QUESTION_TYPE_LABELS } from "../../../utils/questionLabels";
import QuestionSourcePreview from "../QuestionSourcePreview";
import Input from "../../../../../shared/ui/Input";
import ErrorState from "../../ErrorState";
import LoadingState from "../../LoadingState";
import type { ExamSourceFolderDto, QuestionBankTreeNodeDto, TrainingQuestionDto } from "../../../api/types";
import type { FlatTreeNode } from "../types";
import { countNestedQuestions, isCoveredByAllQuestions } from "../sourceSelection";

type Props = {
  sourcesReadOnly: boolean;
  publishedVersion?: number;
  publishedQuestionCount?: number;
  onUpdateFolderScope: (folderId: number, value: boolean) => void;
  treeLoading: boolean;
  treeError: string | null;
  questionsLoading: boolean;
  questionsError: string | null;
  onRetryTree: () => void;
  onRetryQuestions: () => void;
  tree: QuestionBankTreeNodeDto[];
  selectedFolderId: number | null;
  folderQuestions: TrainingQuestionDto[];
  folderSourceMap: Map<number, ExamSourceFolderDto>;
  folderMetaMap: Map<number, FlatTreeNode>;
  query: string;
  sourceQuestionIds: number[];
  onSelectFolder: (folderId: number) => void;
  onToggleFolder: (folderId: number) => void;
  onUpdateFolderPickMode: (folderId: number, value: "ALL" | "RANDOM") => void;
  onUpdateFolderRandomCount: (folderId: number, value: number) => void;
  onQueryChange: (value: string) => void;
  onToggleQuestion: (questionId: number) => void;
};

function FolderTreeNode({
  node,
  level = 0,
  selectedFolderId,
  folderQuestions,
  folderSourceMap,
  onSelectFolder,
  onToggleFolder,
  onUpdateFolderPickMode,
  onUpdateFolderRandomCount,
  onUpdateFolderScope,
  sourcesReadOnly,
  coveredByAncestor = false,
}: {
  node: QuestionBankTreeNodeDto;
  level?: number;
  selectedFolderId: number | null;
  folderQuestions: TrainingQuestionDto[];
  folderSourceMap: Props["folderSourceMap"];
  onSelectFolder: Props["onSelectFolder"];
  onToggleFolder: Props["onToggleFolder"];
  onUpdateFolderPickMode: Props["onUpdateFolderPickMode"];
  onUpdateFolderRandomCount: Props["onUpdateFolderRandomCount"];
  onUpdateFolderScope: Props["onUpdateFolderScope"];
  sourcesReadOnly: boolean;
  coveredByAncestor?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const source = folderSourceMap.get(node.id);
  const descendantsCount = countNestedQuestions(node.children);
  const candidateCount = node.questionCount + (source?.includeDescendants ? descendantsCount : 0);
  const isCurrentFolderSelectedAsSource = source?.pickMode === "ALL" && selectedFolderId === node.id;
  const sourceQuestionCount =
    source?.pickMode === "RANDOM"
      ? Math.min(Math.max(1, Number(source.randomCount ?? 1)), candidateCount)
      : candidateCount;

  return (
    <div key={node.id} className="space-y-1">
      <div
        className={`border-subtle bg-app/40 rounded-xl border p-2 ${selectedFolderId === node.id ? "ring-2 ring-blue-500" : ""}`}
        style={{ marginLeft: `${Math.min(level, 4) * 12}px` }}
      >
        <div className="flex flex-wrap items-start gap-2">
          {node.children.length > 0 && (
            <button
              type="button"
              className="min-h-11 min-w-11"
              aria-label={`${expanded ? "Свернуть" : "Развернуть"} папку «${node.name}»`}
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "▾" : "▸"}
            </button>
          )}
          <button
            type="button"
            className="min-h-11 min-w-0 flex-1 text-left"
            aria-pressed={selectedFolderId === node.id}
            onClick={() => onSelectFolder(node.id)}
          >
            <div className="text-default text-sm font-medium [overflow-wrap:anywhere]">{node.name}</div>
            <div className="text-muted text-xs">В самой папке: {node.questionCount}</div>
            {node.children.length > 0 && <div className="text-muted text-xs">В подпапках: {descendantsCount}</div>}
          </button>

          <label className="text-default flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={sourcesReadOnly || (coveredByAncestor && !source)}
              aria-label={`Добавить папку «${node.name}»`}
              checked={Boolean(source) || coveredByAncestor}
              onChange={() => onToggleFolder(node.id)}
            />
            Добавить
          </label>
        </div>

        {coveredByAncestor && <p className="text-muted text-xs">Входит в выбранную область родительской папки.</p>}
        {source && (
          <fieldset disabled={sourcesReadOnly} className="bg-surface mt-2 space-y-2 rounded-xl p-2">
            <label className="text-default flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(source.includeDescendants)}
                onChange={(event) => onUpdateFolderScope(node.id, event.target.checked)}
              />
              Включая подпапки
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-default flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`pick-mode-${node.id}`}
                  checked={source.pickMode === "ALL"}
                  onChange={() => onUpdateFolderPickMode(node.id, "ALL")}
                />
                Все вопросы
              </label>

              <label className="text-default flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`pick-mode-${node.id}`}
                  checked={source.pickMode === "RANDOM"}
                  onChange={() => onUpdateFolderPickMode(node.id, "RANDOM")}
                />
                Случайные
              </label>

              {source.pickMode === "RANDOM" && (
                <input
                  className="border-subtle bg-surface text-default h-9 w-24 rounded-xl border px-3 text-sm"
                  type="number"
                  min={1}
                  max={candidateCount || undefined}
                  aria-label={`Случайных вопросов из «${node.name}»`}
                  value={source.randomCount ?? 1}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    onUpdateFolderRandomCount(node.id, Number(event.target.value))
                  }
                />
              )}
            </div>

            <div className="text-muted text-xs">
              {sourcesReadOnly ? "Сейчас в банке" : "Из текущего банка"}: {sourceQuestionCount}
            </div>
            {candidateCount === 0 && (
              <p className="text-sm text-amber-700">
                В выбранной области сейчас нет вопросов.
                {sourcesReadOnly
                  ? " Опубликованный состав сохранён. Для новой версии обновите вопросы из банка."
                  : " Включите подпапки или выберите другой источник."}
              </p>
            )}
            {source.pickMode === "RANDOM" && Number(source.randomCount) > candidateCount && (
              <p className="text-sm text-amber-700">
                Запрошено {source.randomCount}, доступно в банке {candidateCount}. Для новой версии нужно пополнить
                область или уменьшить выборку.
              </p>
            )}
          </fieldset>
        )}

        {isCurrentFolderSelectedAsSource && (
          <div className="text-muted mt-2 text-xs">
            Эта папка уже добавлена в тест. Отдельные вопросы из неё выбрать нельзя.
          </div>
        )}
      </div>

      {expanded &&
        node.children.map((child) => (
          <FolderTreeNode
            key={child.id}
            node={child}
            level={level + 1}
            selectedFolderId={selectedFolderId}
            folderQuestions={folderQuestions}
            folderSourceMap={folderSourceMap}
            onSelectFolder={onSelectFolder}
            onToggleFolder={onToggleFolder}
            onUpdateFolderPickMode={onUpdateFolderPickMode}
            onUpdateFolderRandomCount={onUpdateFolderRandomCount}
            onUpdateFolderScope={onUpdateFolderScope}
            sourcesReadOnly={sourcesReadOnly}
            coveredByAncestor={coveredByAncestor || Boolean(source?.includeDescendants)}
          />
        ))}
    </div>
  );
}

export default function ExamSourcesSection({
  sourcesReadOnly,
  publishedVersion,
  publishedQuestionCount,
  onUpdateFolderScope,
  treeLoading,
  treeError,
  questionsLoading,
  questionsError,
  onRetryTree,
  onRetryQuestions,
  tree,
  selectedFolderId,
  folderQuestions,
  folderSourceMap,
  folderMetaMap,
  query,
  sourceQuestionIds,
  onSelectFolder,
  onToggleFolder,
  onUpdateFolderPickMode,
  onUpdateFolderRandomCount,
  onQueryChange,
  onToggleQuestion,
}: Props) {
  const [preview, setPreview] = useState<TrainingQuestionDto | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"folders" | "questions">("folders");
  const selectedFolderCovered = isCoveredByAllQuestions(selectedFolderId, folderMetaMap, folderSourceMap);
  return (
    <section className="space-y-3">
      <div className="text-default text-sm font-semibold">Вопросы для теста</div>
      {sourcesReadOnly && (
        <p className="text-muted text-sm">
          Состав версии {publishedVersion}: {publishedQuestionCount} вопросов. Ниже показано текущее расположение в
          банке; его счётчики могут отличаться от опубликованной версии.
        </p>
      )}
      <div className="flex gap-2 lg:hidden" aria-label="Выбор вопросов">
        <Button
          variant={mobilePanel === "folders" ? "primary" : "outline"}
          aria-pressed={mobilePanel === "folders"}
          onClick={() => setMobilePanel("folders")}
        >
          Папки
        </Button>
        <Button
          variant={mobilePanel === "questions" ? "primary" : "outline"}
          aria-pressed={mobilePanel === "questions"}
          onClick={() => setMobilePanel("questions")}
        >
          Вопросы
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div
          className={`border-subtle space-y-2 rounded-2xl border p-3 ${mobilePanel !== "folders" ? "hidden lg:block" : ""}`}
        >
          <div className="text-default text-sm font-medium">Папки банка вопросов</div>
          <p className="text-muted text-xs">
            Название открывает вопросы. «Добавить» выбирает саму папку; подпапки можно включить отдельно.
          </p>
          <div className="max-h-80 space-y-2 overflow-auto">
            {treeLoading ? (
              <LoadingState label="Загружаем папки банка вопросов…" />
            ) : treeError ? (
              <ErrorState message={treeError} onRetry={onRetryTree} />
            ) : tree.length > 0 ? (
              tree.map((node) => (
                <FolderTreeNode
                  key={node.id}
                  node={node}
                  selectedFolderId={selectedFolderId}
                  folderQuestions={folderQuestions}
                  folderSourceMap={folderSourceMap}
                  onSelectFolder={(id) => {
                    onSelectFolder(id);
                    setMobilePanel("questions");
                  }}
                  onToggleFolder={onToggleFolder}
                  onUpdateFolderPickMode={onUpdateFolderPickMode}
                  onUpdateFolderRandomCount={onUpdateFolderRandomCount}
                  onUpdateFolderScope={onUpdateFolderScope}
                  sourcesReadOnly={sourcesReadOnly}
                />
              ))
            ) : (
              <div className="text-muted text-sm">Нет доступных папок.</div>
            )}
          </div>
        </div>

        <div
          className={`border-subtle space-y-2 rounded-2xl border p-3 ${mobilePanel !== "questions" ? "hidden lg:block" : ""}`}
        >
          <div className="text-default text-sm font-medium">
            {selectedFolderId
              ? `Вопросы из папки "${folderMetaMap.get(selectedFolderId)?.name ?? ""}"`
              : "Выберите папку банка вопросов"}
          </div>

          <Input
            label="Поиск по вопросам"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
            disabled={!selectedFolderId}
          />
          {selectedFolderCovered && (
            <p className="text-muted text-xs">
              Все вопросы этой папки входят в выбранную область. Для выборочного состава уберите источник «Все вопросы».
            </p>
          )}

          <div className="max-h-64 space-y-2 overflow-auto">
            {!selectedFolderId && (
              <div className="text-muted text-sm">Сначала выберите папку, чтобы посмотреть вопросы.</div>
            )}

            {selectedFolderId && questionsLoading && <LoadingState label="Загружаем вопросы…" />}
            {selectedFolderId && !questionsLoading && questionsError && (
              <ErrorState message={questionsError} onRetry={onRetryQuestions} />
            )}
            {selectedFolderId &&
              !questionsLoading &&
              !questionsError &&
              folderQuestions.map((question) => {
                const disabled = sourcesReadOnly || (selectedFolderCovered && !sourceQuestionIds.includes(question.id));

                return (
                  <div key={question.id} className="flex items-start gap-2 rounded-xl px-2 py-2 text-sm">
                    <label className="flex min-w-0 flex-1 items-start gap-2">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={sourceQuestionIds.includes(question.id) || selectedFolderCovered}
                        onChange={() => onToggleQuestion(question.id)}
                      />

                      <div className="min-w-0">
                        <div className="text-default [overflow-wrap:anywhere]">{question.title}</div>
                        <div className="text-muted text-xs">{QUESTION_TYPE_LABELS[question.type]}</div>
                        <p className="text-muted mt-1 line-clamp-2 whitespace-pre-wrap">{question.prompt}</p>
                      </div>
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Просмотреть вопрос «${question.title}»`}
                      onClick={() => setPreview(question)}
                    >
                      Просмотр
                    </Button>
                  </div>
                );
              })}

            {selectedFolderId && !questionsLoading && !questionsError && folderQuestions.length === 0 && (
              <div className="text-muted text-sm">В этой папке нет вопросов по текущему фильтру.</div>
            )}
          </div>
        </div>
      </div>
      {(folderSourceMap.size > 0 || sourceQuestionIds.length > 0) && (
        <div className="border-subtle space-y-2 rounded-xl border p-3">
          <p className="text-default text-sm font-medium">Выбранные источники</p>
          {[...folderSourceMap.values()].map((source) => (
            <div key={source.folderId} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {folderMetaMap.get(source.folderId)?.name ?? `Недоступная папка №${source.folderId}`} ·{" "}
                {source.includeDescendants ? "с подпапками" : "только эта папка"} ·{" "}
                {source.pickMode === "ALL" ? "все" : `случайных: ${source.randomCount}`}
              </span>
              {!sourcesReadOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Убрать источник ${source.folderId}`}
                  onClick={() => onToggleFolder(source.folderId)}
                >
                  Убрать
                </Button>
              )}
            </div>
          ))}
          {sourceQuestionIds.map((id) => (
            <div key={id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {folderQuestions.find((question) => question.id === id)?.title ?? `Вопрос №${id}`} · выбран отдельно
              </span>
              {!sourcesReadOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Убрать вопрос ${id}`}
                  onClick={() => onToggleQuestion(id)}
                >
                  Убрать
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal
        open={preview != null}
        title={preview?.title ?? "Просмотр вопроса"}
        onClose={() => setPreview(null)}
        headerCloseButton
        footer={
          <Button variant="outline" onClick={() => setPreview(null)}>
            Закрыть просмотр
          </Button>
        }
      >
        {preview && <QuestionSourcePreview question={preview} />}
      </Modal>
    </section>
  );
}

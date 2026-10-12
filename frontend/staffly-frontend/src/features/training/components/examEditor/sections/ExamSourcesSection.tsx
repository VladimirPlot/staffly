import { useState, type ChangeEvent } from "react";
import Modal from "../../../../../shared/ui/Modal";
import Button from "../../../../../shared/ui/Button";
import { QUESTION_TYPE_LABELS } from "../../../utils/questionLabels";
import QuestionSourcePreview from "../QuestionSourcePreview";
import Input from "../../../../../shared/ui/Input";
import ErrorState from "../../ErrorState";
import LoadingState from "../../LoadingState";
import type { QuestionBankTreeNodeDto, TrainingQuestionDto } from "../../../api/types";
import type { FlatTreeNode } from "../types";

type Props = {
  treeLoading: boolean;
  treeError: string | null;
  questionsLoading: boolean;
  questionsError: string | null;
  onRetryTree: () => void;
  onRetryQuestions: () => void;
  tree: QuestionBankTreeNodeDto[];
  selectedFolderId: number | null;
  folderQuestions: TrainingQuestionDto[];
  folderSourceMap: Map<number, { folderId: number; pickMode: "ALL" | "RANDOM"; randomCount?: number | null }>;
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
}) {
  const source = folderSourceMap.get(node.id);
  const isCurrentFolderSelectedAsSource = Boolean(source) && selectedFolderId === node.id;
  const sourceQuestionCount =
    source?.pickMode === "RANDOM"
      ? Math.min(Math.max(1, Number(source.randomCount ?? 1)), node.questionCount)
      : node.questionCount;

  return (
    <div key={node.id} className="space-y-1">
      <div className="border-subtle bg-app/40 rounded-xl border p-2" style={{ marginLeft: `${level * 12}px` }}>
        <div className="flex flex-wrap items-start gap-2">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectFolder(node.id)}>
            <div className="text-default truncate text-sm font-medium">{node.name}</div>
            <div className="text-muted text-xs">{node.questionCount} вопросов</div>
          </button>

          <label className="text-default flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(source)} onChange={() => onToggleFolder(node.id)} />
            Добавить
          </label>
        </div>

        {source && (
          <div className="bg-surface mt-2 space-y-2 rounded-xl p-2">
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
                  max={node.questionCount}
                  value={source.randomCount ?? 1}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    onUpdateFolderRandomCount(node.id, Number(event.target.value))
                  }
                />
              )}
            </div>

            <div className="text-muted text-xs">В тест попадёт: {sourceQuestionCount}</div>
          </div>
        )}

        {isCurrentFolderSelectedAsSource && (
          <div className="text-muted mt-2 text-xs">
            Эта папка уже добавлена в тест. Отдельные вопросы из неё выбрать нельзя.
          </div>
        )}
      </div>

      {node.children.map((child) => (
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
        />
      ))}
    </div>
  );
}

export default function ExamSourcesSection({
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
  return (
    <section className="space-y-3">
      <div className="text-default text-sm font-semibold">Вопросы для теста</div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="border-subtle space-y-2 rounded-2xl border p-3">
          <div className="text-default text-sm font-medium">Папки банка вопросов</div>
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
                  onSelectFolder={onSelectFolder}
                  onToggleFolder={onToggleFolder}
                  onUpdateFolderPickMode={onUpdateFolderPickMode}
                  onUpdateFolderRandomCount={onUpdateFolderRandomCount}
                />
              ))
            ) : (
              <div className="text-muted text-sm">Нет доступных папок.</div>
            )}
          </div>
        </div>

        <div className="border-subtle space-y-2 rounded-2xl border p-3">
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
                const disabled = folderSourceMap.has(selectedFolderId);

                return (
                  <div
                    key={question.id}
                    className={`flex items-start gap-2 rounded-xl px-2 py-2 text-sm ${disabled ? "opacity-60" : ""}`}
                  >
                    <label className="flex min-w-0 flex-1 items-start gap-2">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={sourceQuestionIds.includes(question.id)}
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

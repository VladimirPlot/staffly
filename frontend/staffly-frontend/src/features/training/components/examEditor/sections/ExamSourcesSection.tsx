import type { ChangeEvent } from "react";
import Input from "../../../../../shared/ui/Input";
import type { QuestionBankTreeNodeDto, TrainingQuestionDto } from "../../../api/types";
import type { FlatTreeNode } from "../types";

type Props = {
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
      <div className="rounded-xl border border-subtle bg-app/40 p-2" style={{ marginLeft: `${level * 12}px` }}>
        <div className="flex flex-wrap items-start gap-2">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectFolder(node.id)}>
            <div className="truncate text-sm font-medium text-default">{node.name}</div>
            <div className="text-xs text-muted">{node.questionCount} вопросов</div>
          </button>

          <label className="flex items-center gap-2 text-sm text-default">
            <input type="checkbox" checked={Boolean(source)} onChange={() => onToggleFolder(node.id)} />
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
                  onChange={() => onUpdateFolderPickMode(node.id, "ALL")}
                />
                Все вопросы
              </label>

              <label className="flex items-center gap-2 text-sm text-default">
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
                  className="h-9 w-24 rounded-xl border border-subtle bg-surface px-3 text-sm text-default"
                  type="number"
                  min={1}
                  max={node.questionCount}
                  value={source.randomCount ?? 1}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onUpdateFolderRandomCount(node.id, Number(event.target.value))}
                />
              )}
            </div>

            <div className="text-xs text-muted">В тест попадёт: {sourceQuestionCount}</div>
          </div>
        )}

        {isCurrentFolderSelectedAsSource && (
          <div className="mt-2 text-xs text-muted">
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
  return (
    <section className="space-y-3">
      <div className="text-sm font-semibold text-default">Вопросы для теста</div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-subtle p-3">
          <div className="text-sm font-medium text-default">Папки банка вопросов</div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {tree.length > 0 ? (
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

          <Input label="Поиск по вопросам" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)} disabled={!selectedFolderId} />

          <div className="max-h-64 space-y-2 overflow-auto">
            {!selectedFolderId && (
              <div className="text-sm text-muted">Сначала выберите папку, чтобы посмотреть вопросы.</div>
            )}

            {selectedFolderId &&
              folderQuestions.map((question) => {
                const disabled = folderSourceMap.has(selectedFolderId);

                return (
                  <label
                    key={question.id}
                    className={`flex items-start gap-2 rounded-xl px-2 py-2 text-sm ${disabled ? "opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={sourceQuestionIds.includes(question.id)}
                      onChange={() => onToggleQuestion(question.id)}
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
  );
}

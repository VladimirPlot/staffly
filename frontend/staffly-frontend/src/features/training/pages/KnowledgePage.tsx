import { useCallback, useEffect, useState } from "react";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FolderList from "../components/FolderList";
import LoadingState from "../components/LoadingState";
import { mapKnowledgeItemsForUi } from "../api/mappers";
import { deleteKnowledgeItem, hideKnowledgeItem, listKnowledgeItems, restoreKnowledgeItem } from "../api/trainingApi";
import type { TrainingFolderDto, TrainingKnowledgeItemDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function KnowledgePage() {
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "KNOWLEDGE", canManage });

  const [selectedFolder, setSelectedFolder] = useState<TrainingFolderDto | null>(null);
  const [items, setItems] = useState<TrainingKnowledgeItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemActionLoadingId, setItemActionLoadingId] = useState<number | null>(null);

  const loadItems = useCallback(async () => {
    if (!restaurantId || !selectedFolder) return;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const response = await listKnowledgeItems(
        restaurantId,
        selectedFolder.id,
        canManage ? foldersState.includeInactive : false
      );
      setItems(mapKnowledgeItemsForUi(response));
    } catch (e) {
      setItemsError(getTrainingErrorMessage(e, "Не удалось загрузить материалы папки."));
    } finally {
      setItemsLoading(false);
    }
  }, [restaurantId, selectedFolder, canManage, foldersState.includeInactive]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const runItemAction = async (itemId: number, action: "hide" | "restore" | "delete") => {
    if (!restaurantId) return;
    setItemActionLoadingId(itemId);
    try {
      if (action === "hide") await hideKnowledgeItem(restaurantId, itemId);
      if (action === "restore") await restoreKnowledgeItem(restaurantId, itemId);
      if (action === "delete") await deleteKnowledgeItem(restaurantId, itemId);
      await loadItems();
    } catch (e) {
      setItemsError(getTrainingErrorMessage(e, "Не удалось выполнить действие с материалом."));
    } finally {
      setItemActionLoadingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "База знаний" }]} />
      <h2 className="text-2xl font-semibold">📚 База знаний</h2>

      {canManage && (
        <label className="inline-flex items-center gap-2 text-sm text-default">
          <input
            type="checkbox"
            checked={foldersState.includeInactive}
            onChange={(e) => foldersState.setIncludeInactive(e.target.checked)}
          />
          Показывать скрытые
        </label>
      )}

      {foldersState.loading && <LoadingState label="Загрузка папок базы знаний…" />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
      {!foldersState.loading && !foldersState.error && foldersState.folders.length === 0 && (
        <EmptyState title="Папки не найдены" description="Добавьте первую папку базы знаний." />
      )}

      {foldersState.folders.length > 0 && (
        <FolderList
          folders={foldersState.folders}
          canManage={canManage}
          actionLoadingId={foldersState.actionLoadingId}
          onSelect={setSelectedFolder}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
        />
      )}

      {selectedFolder && (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Материалы папки: {selectedFolder.name}</h3>

          {itemsLoading && <LoadingState label="Загрузка материалов…" />}
          {itemsError && <ErrorState message={itemsError} onRetry={loadItems} />}

          {!itemsLoading && !itemsError && items.length === 0 && (
            <EmptyState title="Материалов пока нет" description="Создайте карточки знаний для этой папки." />
          )}

          {!itemsLoading && !itemsError && items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-subtle bg-app p-3">
                  <div className="font-medium">{item.title}</div>

                  {item.description && <div className="mt-1 text-sm text-muted line-clamp-3">{item.description}</div>}
                  {!item.active && <div className="mt-1 text-xs text-amber-600">Скрыт</div>}

                  {canManage && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" disabled>
                        Редактировать
                      </Button>

                      {item.active ? (
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={itemActionLoadingId === item.id}
                          onClick={() => runItemAction(item.id, "hide")}
                        >
                          Скрыть
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            isLoading={itemActionLoadingId === item.id}
                            onClick={() => runItemAction(item.id, "restore")}
                          >
                            Восстановить
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            isLoading={itemActionLoadingId === item.id}
                            onClick={() => runItemAction(item.id, "delete")}
                          >
                            Удалить
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FolderList from "../components/FolderList";
import LoadingState from "../components/LoadingState";
import TrainingFolderModal from "../components/TrainingFolderModal";
import { deleteFolder } from "../api/trainingApi";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../utils/errors";
import { bySortOrderAndName } from "../utils/sort";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function QuestionBankRootPage() {
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "QUESTION_BANK", canManage });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<import("../api/types").TrainingFolderDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rootFolders = useMemo(() => foldersState.folders.filter((folder) => folder.parentId === null).sort(bySortOrderAndName), [foldersState.folders]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Банк вопросов" }]} />
      <h2 className="text-2xl font-semibold">Банк вопросов</h2>
      {canManage && <div className="border-subtle bg-surface rounded-2xl border p-3 flex justify-between"><Switch label="Скрытые элементы" checked={foldersState.includeInactive} onChange={(event) => foldersState.setIncludeInactive(event.target.checked)} /><Button variant="outline" onClick={() => { setEditingFolder(null); setModalOpen(true); }}>Создать папку</Button></div>}
      {foldersState.loading && <LoadingState label="Загрузка папок банка вопросов…" />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
      {error && <ErrorState message={error} onRetry={foldersState.reload} />}
      {!foldersState.loading && rootFolders.length === 0 && <EmptyState title="Папок пока нет" description="Создайте первую папку для вопросов." />}
      {rootFolders.length > 0 && <FolderList folders={rootFolders} canManage={canManage} actionLoadingId={foldersState.actionLoadingId} onOpen={(id) => navigate(trainingRoutes.questionBankFolder(id))} onEdit={(f) => { setEditingFolder(f); setModalOpen(true); }} onHide={foldersState.hide} onRestore={foldersState.restore} onDelete={async (id) => { if (!restaurantId) return; try { await deleteFolder(restaurantId, id); await foldersState.reload(); } catch (e) { setError(getTrainingErrorMessage(e, "Не удалось удалить папку.")); } }} />}
      {restaurantId && <TrainingFolderModal open={modalOpen} mode={editingFolder ? "edit" : "create"} restaurantId={restaurantId} type="QUESTION_BANK" initialFolder={editingFolder} onClose={() => setModalOpen(false)} onSaved={foldersState.reload} />}
    </div>
  );
}

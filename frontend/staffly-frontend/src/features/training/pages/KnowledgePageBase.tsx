import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import KnowledgeHeader from "../components/KnowledgeHeader";
import LoadingState from "../components/LoadingState";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { trainingRoutes } from "../utils/trainingRoutes";
import { useKnowledgeBreadcrumbs } from "./knowledge/KnowledgeBreadcrumbs";
import KnowledgeCardsSection from "./knowledge/KnowledgeCardsSection";
import KnowledgeFoldersSection from "./knowledge/KnowledgeFoldersSection";
import KnowledgeModals from "./knowledge/KnowledgeModals";
import KnowledgePracticeExamsSection from "./knowledge/KnowledgePracticeExamsSection";
import { useKnowledgePageState } from "./knowledge/useKnowledgePageState";

type Props = {
  currentFolderId: number | null;
};

export default function KnowledgePageBase({ currentFolderId }: Props) {
  const { restaurantId, canManage } = useTrainingAccess();
  const state = useKnowledgePageState({ currentFolderId, restaurantId: restaurantId ?? undefined, canManage });
  const breadcrumbItems = useKnowledgeBreadcrumbs(state.currentFolder, state.folderMap);

  if (state.showFolderNotFound) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Breadcrumbs items={breadcrumbItems} />
        <ErrorState
          message="Папка не найдена или недоступна"
          actionLabel="К списку"
          onRetry={() => state.navigate(trainingRoutes.knowledge)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={breadcrumbItems} />
      <h2 className="text-2xl font-semibold">{state.currentFolder?.name ?? "База знаний"}</h2>

      <KnowledgeHeader
        canManage={canManage}
        includeInactive={state.foldersState.includeInactive}
        onToggleIncludeInactive={state.foldersState.setIncludeInactive}
        positions={state.visiblePositions}
        positionFilter={state.positionFilter}
        onChangePositionFilter={state.setPositionFilter}
        onCreateFolder={state.openCreateFolderModal}
        onCreateCard={state.openCreateItemModal}
        onCreateTest={state.openCreateExamModal}
      />

      {state.foldersState.loading && <LoadingState label="Загрузка папок базы знаний…" />}
      {state.foldersState.error && <ErrorState message={state.foldersState.error} onRetry={state.foldersState.reload} />}
      {state.folderError && <ErrorState message={state.folderError} onRetry={state.foldersState.reload} />}

      <KnowledgeFoldersSection
        folders={state.childFolders}
        canManage={canManage}
        actionLoadingId={state.actionLoadingId ?? state.foldersState.actionLoadingId}
        positionNameById={state.positionNameById}
        onOpen={(id) => state.navigate(`${trainingRoutes.knowledge}/${id}`)}
        onEdit={(folder) => {
          state.setEditingFolder(folder);
          state.setFolderModalOpen(true);
        }}
        onHide={state.foldersState.hide}
        onRestore={state.foldersState.restore}
        onDelete={state.runDelete}
      />

      <KnowledgePracticeExamsSection
        examsLoading={state.examsLoading}
        examsError={state.examsError}
        practiceExams={state.practiceExams}
        canManage={canManage}
        examActionLoadingId={state.examActionLoadingId}
        progressByExamId={state.progressByExamId}
        inProgressExamIds={state.inProgressExamIds}
        currentFolderId={currentFolderId}
        onRetry={state.loadPracticeExams}
        onEdit={(exam) => {
          state.setEditingExam(exam);
          state.setExamModalOpen(true);
        }}
        onExamAction={state.runExamAction}
      />

      <KnowledgeCardsSection
        itemsLoading={state.itemsLoading}
        itemsError={state.itemsError}
        items={state.items}
        canManage={canManage}
        actionLoadingId={state.itemActionLoadingId}
        actionLoadingType={state.itemActionLoadingType}
        onRetry={state.loadItems}
        onEdit={state.openEditItemModal}
        onHide={(id) => state.runItemAction(id, "hide")}
        onRestore={(id) => state.runItemAction(id, "restore")}
        onDelete={(id) => state.runItemAction(id, "delete")}
      />

      {state.isCompletelyEmpty && (
        <EmptyState title="Пока пусто" description="Создайте папку или карточку." />
      )}

      <KnowledgeModals
        restaurantId={state.restaurantId}
        currentFolderId={currentFolderId}
        folderMap={state.folderMap}
        currentFolder={state.currentFolder}
        folderModalOpen={state.folderModalOpen}
        editingFolder={state.editingFolder}
        onCloseFolderModal={() => {
          state.setEditingFolder(null);
          state.setFolderModalOpen(false);
        }}
        onSavedFolder={state.foldersState.reload}
        examModalOpen={state.examModalOpen}
        editingExam={state.editingExam}
        onCloseExamModal={() => {
          state.setEditingExam(null);
          state.setExamModalOpen(false);
        }}
        onSavedExam={state.loadPracticeExams}
        knowledgeModalOpen={state.knowledgeModalOpen}
        knowledgeModalMode={state.knowledgeModalMode}
        editingItem={state.editingItem}
        onCloseKnowledgeModal={() => state.setKnowledgeModalOpen(false)}
        onSavedKnowledge={state.loadItems}
      />
    </div>
  );
}

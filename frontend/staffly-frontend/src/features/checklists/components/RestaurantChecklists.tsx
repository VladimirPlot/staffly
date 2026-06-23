import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../../../shared/providers/AuthProvider";
import Card from "../../../shared/ui/Card";
import { deleteChecklist, type ChecklistDto, type ChecklistKind } from "../api";
import { useChecklistCardUiState } from "../hooks/useChecklistCardUiState";
import { useChecklistDialogController } from "../hooks/useChecklistDialogController";
import { useChecklistHistory } from "../hooks/useChecklistHistory";
import { useChecklistItemActions } from "../hooks/useChecklistItemActions";
import { useChecklistsData } from "../hooks/useChecklistsData";
import type { ChecklistTab, PhotoPreview } from "../types";
import ChecklistDialog from "./ChecklistDialog";
import ChecklistHistoryModal from "./ChecklistHistoryModal";
import ChecklistList from "./ChecklistList";
import ChecklistsToolbar from "./ChecklistsToolbar";
import DeleteChecklistConfirmDialog from "./DeleteChecklistConfirmDialog";
import PhotoPreviewModal from "./PhotoPreviewModal";

export type RestaurantChecklistsProps = {
  restaurantId: number;
  canManage: boolean;
  createDialogRequestKey?: number;
};

const RestaurantChecklists = ({ restaurantId, canManage, createDialogRequestKey }: RestaurantChecklistsProps) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab: ChecklistTab = searchParams.get("tab") === "scripts" ? "scripts" : "checklists";
  const activeKind: ChecklistKind = activeTab === "scripts" ? "INFO" : "TRACKABLE";
  const emptyStateLabel = activeTab === "scripts" ? "Скрипты пока не добавлены." : "Чек-листы пока не добавлены.";

  const cardUi = useChecklistCardUiState();
  const data = useChecklistsData({
    restaurantId,
    canManage,
    currentUserId: user?.id,
    activeKind,
    onListLoaded: cardUi.resetExpandedState,
  });
  const dialog = useChecklistDialogController({
    restaurantId,
    activeKind,
    activeTab,
    reloadChecklists: data.loadChecklists,
  });
  const itemActions = useChecklistItemActions({
    restaurantId,
    updateChecklistInState: data.updateChecklistInState,
    reloadChecklists: data.loadChecklists,
  });
  const history = useChecklistHistory(restaurantId);

  const [deleteTarget, setDeleteTarget] = useState<ChecklistDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null);
  const lastCreateDialogRequestKey = useRef(createDialogRequestKey);
  const resetExpandedState = cardUi.resetExpandedState;
  const openCreateDialog = dialog.openCreateDialog;
  const reloadChecklists = data.loadChecklists;
  const closeChecklistHistoryModal = history.closeHistoryModal;

  useEffect(() => {
    resetExpandedState();
  }, [activeKind, data.debouncedQuery, data.positionFilter, data.viewScope, resetExpandedState]);

  useEffect(() => {
    if (createDialogRequestKey == null || lastCreateDialogRequestKey.current === createDialogRequestKey) return;
    lastCreateDialogRequestKey.current = createDialogRequestKey;
    openCreateDialog();
  }, [createDialogRequestKey, openCreateDialog]);

  const openDeleteDialog = useCallback((checklist: ChecklistDto) => {
    setDeleteTarget(checklist);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteChecklist(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await reloadChecklists();
    } catch (e) {
      console.error("Failed to delete checklist", e);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, reloadChecklists, restaurantId]);

  const closePhotoPreview = useCallback(() => {
    setPhotoPreview(null);
  }, []);

  const closeHistoryModal = useCallback(() => {
    if (photoPreview) {
      closePhotoPreview();
      return;
    }
    closeChecklistHistoryModal();
  }, [closeChecklistHistoryModal, closePhotoPreview, photoPreview]);

  return (
    <Card className="mt-4">
      <ChecklistsToolbar
        canManage={canManage}
        positions={data.positions}
        myPositionId={data.myPositionId}
        viewScope={data.viewScope}
        positionFilter={data.positionFilter}
        searchTerm={data.searchTerm}
        onSearchTermChange={data.setSearchTerm}
        onViewScopeChange={data.handleViewScopeChange}
        onPositionFilterChange={data.handlePositionFilterChange}
        onResetFilter={data.resetFilter}
      />

      <ChecklistList
        restaurantId={restaurantId}
        checklists={data.visibleChecklists}
        canManage={canManage}
        positionNames={data.positionNames}
        emptyStateLabel={emptyStateLabel}
        isListLoading={data.isListLoading}
        error={data.error}
        itemActionError={itemActions.itemActionError}
        expandedId={cardUi.expandedId}
        activeItemTab={cardUi.activeItemTab}
        resetting={itemActions.resetting}
        downloading={cardUi.downloading}
        actionMenuFor={cardUi.actionMenuFor}
        itemActionLoading={itemActions.itemActionLoading}
        photoUploading={itemActions.photoUploading}
        onChecklistRef={cardUi.setChecklistRef}
        onActionMenuRef={cardUi.setActionMenuRef}
        onToggleExpanded={cardUi.toggleExpanded}
        onToggleActionMenu={cardUi.toggleActionMenu}
        onCloseActionMenu={cardUi.closeActionMenu}
        onDownloadJpg={cardUi.handleDownloadJpg}
        onEdit={dialog.openEditDialog}
        onOpenHistory={history.openHistoryModal}
        onDelete={openDeleteDialog}
        onActiveItemTabChange={cardUi.setActiveItemTab}
        onItemAction={itemActions.handleItemAction}
        onCompletionPhotoUpload={itemActions.handleCompletionPhotoUpload}
        onCompletionPhotoDelete={itemActions.handleCompletionPhotoDelete}
        onReset={itemActions.handleReset}
        onPhotoPreview={setPhotoPreview}
      />

      <ChecklistDialog
        open={dialog.dialogOpen}
        title={dialog.createDialogTitle}
        positions={data.positions}
        initialData={dialog.dialogInitial}
        submitting={dialog.dialogSubmitting}
        error={dialog.dialogError}
        onClose={dialog.closeDialog}
        onSubmit={dialog.handleSubmitDialog}
      />

      <DeleteChecklistConfirmDialog
        target={deleteTarget}
        deleting={deleting}
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
      />

      <ChecklistHistoryModal
        target={history.historyTarget}
        summaries={history.historySummaries}
        detail={history.historyDetail}
        loading={history.historyLoading}
        detailLoading={history.historyDetailLoading}
        error={history.historyError}
        onClose={closeHistoryModal}
        onLoadDetail={history.loadHistoryDetail}
        onPhotoPreview={setPhotoPreview}
      />

      <PhotoPreviewModal preview={photoPreview} onClose={closePhotoPreview} />
    </Card>
  );
};

export default RestaurantChecklists;

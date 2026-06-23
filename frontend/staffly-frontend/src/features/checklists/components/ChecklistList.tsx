import Card from "../../../shared/ui/Card";
import type { ChecklistDto, ChecklistItemDto } from "../api";
import type { ChecklistItemSectionKey, PhotoPreview } from "../types";
import ChecklistCard from "./ChecklistCard";

type ChecklistListProps = {
  restaurantId: number;
  checklists: ChecklistDto[];
  canManage: boolean;
  positionNames: Map<number, string>;
  emptyStateLabel: string;
  isListLoading: boolean;
  error: string | null;
  itemActionError: string | null;
  expandedId: number | null;
  activeItemTab: ChecklistItemSectionKey;
  resetting: number | null;
  downloading: number | null;
  actionMenuFor: number | null;
  itemActionLoading: Set<string>;
  mediaExpanded: Set<string>;
  photoUploading: Set<string>;
  onChecklistRef: (id: number, node: HTMLDivElement | null) => void;
  onActionMenuRef: (id: number, node: HTMLDivElement | null) => void;
  onToggleExpanded: (checklist: ChecklistDto) => void;
  onToggleActionMenu: (checklistId: number) => void;
  onCloseActionMenu: () => void;
  onDownloadJpg: (checklist: ChecklistDto) => void;
  onEdit: (checklist: ChecklistDto) => void;
  onOpenHistory: (checklist: ChecklistDto) => void;
  onDelete: (checklist: ChecklistDto) => void;
  onActiveItemTabChange: (tab: ChecklistItemSectionKey) => void;
  onItemAction: (key: string, action: () => Promise<ChecklistDto>) => void;
  onToggleMediaExpanded: (checklistId: number, itemId: number) => void;
  onCompletionPhotoUpload: (checklist: ChecklistDto, item: ChecklistItemDto, file: File) => void;
  onCompletionPhotoDelete: (checklist: ChecklistDto, item: ChecklistItemDto) => void;
  onReset: (checklist: ChecklistDto) => void;
  onPhotoPreview: (preview: PhotoPreview) => void;
};

export default function ChecklistList({
  restaurantId,
  checklists,
  canManage,
  positionNames,
  emptyStateLabel,
  isListLoading,
  error,
  itemActionError,
  expandedId,
  activeItemTab,
  resetting,
  downloading,
  actionMenuFor,
  itemActionLoading,
  mediaExpanded,
  photoUploading,
  onChecklistRef,
  onActionMenuRef,
  onToggleExpanded,
  onToggleActionMenu,
  onCloseActionMenu,
  onDownloadJpg,
  onEdit,
  onOpenHistory,
  onDelete,
  onActiveItemTabChange,
  onItemAction,
  onToggleMediaExpanded,
  onCompletionPhotoUpload,
  onCompletionPhotoDelete,
  onReset,
  onPhotoPreview,
}: ChecklistListProps) {
  return (
    <div className="mt-6 space-y-3">
      {isListLoading && <Card className="text-muted text-sm">Загрузка чек-листов…</Card>}
      {error && <Card className="text-sm text-red-700 dark:text-red-300">{error}</Card>}
      {itemActionError && <Card className="text-sm text-red-700 dark:text-red-300">{itemActionError}</Card>}
      {!isListLoading && !error && checklists.length === 0 && (
        <Card className="text-muted text-sm">{emptyStateLabel}</Card>
      )}
      {!isListLoading &&
        !error &&
        checklists.map((checklist) => (
          <ChecklistCard
            key={checklist.id}
            restaurantId={restaurantId}
            checklist={checklist}
            canManage={canManage}
            positionNames={positionNames}
            isExpanded={expandedId === checklist.id}
            activeItemTab={activeItemTab}
            isResetting={resetting === checklist.id}
            isDownloading={downloading === checklist.id}
            isActionMenuOpen={actionMenuFor === checklist.id}
            itemActionLoading={itemActionLoading}
            mediaExpanded={mediaExpanded}
            photoUploading={photoUploading}
            onChecklistRef={onChecklistRef}
            onActionMenuRef={onActionMenuRef}
            onToggleExpanded={onToggleExpanded}
            onToggleActionMenu={onToggleActionMenu}
            onCloseActionMenu={onCloseActionMenu}
            onDownloadJpg={onDownloadJpg}
            onEdit={onEdit}
            onOpenHistory={onOpenHistory}
            onDelete={onDelete}
            onActiveItemTabChange={onActiveItemTabChange}
            onItemAction={onItemAction}
            onToggleMediaExpanded={onToggleMediaExpanded}
            onCompletionPhotoUpload={onCompletionPhotoUpload}
            onCompletionPhotoDelete={onCompletionPhotoDelete}
            onReset={onReset}
            onPhotoPreview={onPhotoPreview}
          />
        ))}
    </div>
  );
}

import Button from "../../../shared/ui/Button";
import type { ChecklistDto, ChecklistItemDto } from "../api";
import type { PhotoPreview } from "../types";
import ChecklistItemRow from "./ChecklistItemRow";

type TrackableChecklistPanelProps = {
  restaurantId: number;
  checklist: ChecklistDto;
  canManage: boolean;
  resetting: boolean;
  itemActionLoading: Set<string>;
  photoUploading: Set<string>;
  onItemAction: (key: string, action: () => Promise<ChecklistDto>) => void;
  onCompletionPhotoUpload: (checklist: ChecklistDto, item: ChecklistItemDto, file: File) => void;
  onCompletionPhotoDelete: (checklist: ChecklistDto, item: ChecklistItemDto) => void;
  onReset: (checklist: ChecklistDto) => void;
  onPhotoPreview: (preview: PhotoPreview) => void;
};

export default function TrackableChecklistPanel({
  restaurantId,
  checklist,
  canManage,
  resetting,
  itemActionLoading,
  photoUploading,
  onItemAction,
  onCompletionPhotoUpload,
  onCompletionPhotoDelete,
  onReset,
  onPhotoPreview,
}: TrackableChecklistPanelProps) {
  const isChecklistBusy =
    resetting || [...itemActionLoading, ...photoUploading].some((key) => key.startsWith(`${checklist.id}-`));

  return (
    <div>
      {checklist.items.length === 0 ? (
        <div className="text-muted px-4 py-8 text-center text-sm">В чек-листе пока нет пунктов.</div>
      ) : (
        <div className="overflow-hidden">
          {checklist.items.map((item) => {
            const completionPhotoKey = `${checklist.id}-${item.id}-completion-photo`;
            return (
              <ChecklistItemRow
                key={item.id}
                restaurantId={restaurantId}
                checklist={checklist}
                item={item}
                canManage={canManage}
                itemActionLoading={itemActionLoading}
                isPhotoUploading={photoUploading.has(completionPhotoKey)}
                isChecklistBusy={isChecklistBusy}
                onItemAction={onItemAction}
                onCompletionPhotoUpload={onCompletionPhotoUpload}
                onCompletionPhotoDelete={onCompletionPhotoDelete}
                onPhotoPreview={onPhotoPreview}
              />
            );
          })}
        </div>
      )}

      {canManage && (
        <div className="border-subtle bg-app/40 mt-1 flex flex-wrap gap-2 border-t px-3 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReset(checklist)}
            disabled={isChecklistBusy}
            aria-label="Сбросить чек-лист"
            title="Сбросить чек-лист"
            className="h-9 rounded-xl px-3 shadow-none"
          >
            {resetting ? "Сбрасываем…" : "Сбросить"}
          </Button>
        </div>
      )}
    </div>
  );
}

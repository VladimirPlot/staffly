import { AnimatePresence, motion } from "framer-motion";

import Button from "../../../shared/ui/Button";
import {
  EMPTY_ITEM_TAB_MESSAGES,
  TAB_CONTENT_ENTER,
  TAB_CONTENT_EXIT,
  TAB_CONTENT_TRANSITION,
  TAB_CONTENT_VISIBLE,
} from "../constants";
import type { ChecklistDto, ChecklistItemDto } from "../api";
import type { ChecklistItemGroups, ChecklistItemSectionKey, PhotoPreview } from "../types";
import ChecklistItemRow from "./ChecklistItemRow";
import ChecklistItemTabs from "./ChecklistItemTabs";

type TrackableChecklistPanelProps = {
  restaurantId: number;
  checklist: ChecklistDto;
  canManage: boolean;
  itemGroups: ChecklistItemGroups;
  activeItemTab: ChecklistItemSectionKey;
  resetting: boolean;
  itemActionLoading: Set<string>;
  photoUploading: Set<string>;
  onActiveItemTabChange: (tab: ChecklistItemSectionKey) => void;
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
  itemGroups,
  activeItemTab,
  resetting,
  itemActionLoading,
  photoUploading,
  onActiveItemTabChange,
  onItemAction,
  onCompletionPhotoUpload,
  onCompletionPhotoDelete,
  onReset,
  onPhotoPreview,
}: TrackableChecklistPanelProps) {
  const activeItems = itemGroups[activeItemTab];

  return (
    <div>
      <ChecklistItemTabs
        checklistId={checklist.id}
        itemGroups={itemGroups}
        activeItemTab={activeItemTab}
        onActiveItemTabChange={onActiveItemTabChange}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeItemTab}
          initial={TAB_CONTENT_ENTER}
          animate={TAB_CONTENT_VISIBLE}
          exit={TAB_CONTENT_EXIT}
          transition={TAB_CONTENT_TRANSITION}
        >
          {activeItems.length === 0 ? (
            <div className="text-muted px-4 py-8 text-center text-sm">{EMPTY_ITEM_TAB_MESSAGES[activeItemTab]}</div>
          ) : (
            <div className="overflow-hidden">
              {activeItems.map((item) => {
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
                    onItemAction={onItemAction}
                    onCompletionPhotoUpload={onCompletionPhotoUpload}
                    onCompletionPhotoDelete={onCompletionPhotoDelete}
                    onPhotoPreview={onPhotoPreview}
                  />
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {canManage && (
        <div className="border-subtle bg-app/40 mt-1 flex flex-wrap gap-2 border-t px-3 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReset(checklist)}
            disabled={resetting}
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

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Clock } from "lucide-react";

import ContentText from "../../../shared/ui/ContentText";
import Icon from "../../../shared/ui/Icon";
import { EXPANDED_PANEL_TRANSITION, PANEL_COLLAPSED, PANEL_EXPANDED } from "../constants";
import type { ChecklistDto, ChecklistItemDto } from "../api";
import type { ChecklistItemSectionKey, PhotoPreview } from "../types";
import { getChecklistItemTotal, getChecklistWorkSummary, groupChecklistItems } from "../utils/checklistItems";
import ChecklistActionMenu from "./ChecklistActionMenu";
import ChecklistProgressIndicator from "./ChecklistProgressIndicator";
import TrackableChecklistPanel from "./TrackableChecklistPanel";

type ChecklistCardProps = {
  restaurantId: number;
  checklist: ChecklistDto;
  canManage: boolean;
  positionNames: Map<number, string>;
  isExpanded: boolean;
  activeItemTab: ChecklistItemSectionKey;
  isResetting: boolean;
  isDownloading: boolean;
  isActionMenuOpen: boolean;
  itemActionLoading: Set<string>;
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
  onCompletionPhotoUpload: (checklist: ChecklistDto, item: ChecklistItemDto, file: File) => void;
  onCompletionPhotoDelete: (checklist: ChecklistDto, item: ChecklistItemDto) => void;
  onReset: (checklist: ChecklistDto) => void;
  onPhotoPreview: (preview: PhotoPreview) => void;
};

export default function ChecklistCard({
  restaurantId,
  checklist,
  canManage,
  positionNames,
  isExpanded,
  activeItemTab,
  isResetting,
  isDownloading,
  isActionMenuOpen,
  itemActionLoading,
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
  onCompletionPhotoUpload,
  onCompletionPhotoDelete,
  onReset,
  onPhotoPreview,
}: ChecklistCardProps) {
  const isTrackable = checklist.kind === "TRACKABLE";
  const itemGroups = groupChecklistItems(checklist.items);
  const workSummary = isTrackable ? getChecklistWorkSummary(checklist, itemGroups) : null;
  const total = getChecklistItemTotal(itemGroups);
  const doneCount = itemGroups.done.length;
  const showPeriodLabel = isTrackable && Boolean(checklist.periodLabel);
  const showPositions = canManage && checklist.positions.length > 0;
  const showMeta = showPeriodLabel || canManage;

  return (
    <div className="border-subtle bg-app/70 rounded-2xl border p-4" ref={(node) => onChecklistRef(checklist.id, node)}>
      <div className="flex items-start justify-between gap-4">
        <div
          className="ring-default min-w-0 flex-1 cursor-pointer rounded-xl text-left focus:ring-2 focus:outline-none"
          onClick={() => onToggleExpanded(checklist)}
          role="button"
          aria-expanded={isExpanded}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggleExpanded(checklist);
            }
          }}
        >
          <div className="flex items-start gap-3">
            {isTrackable && workSummary && (
              <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                <ChecklistProgressIndicator summary={workSummary} doneCount={doneCount} total={total} />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-strong text-base leading-6 font-semibold [overflow-wrap:anywhere]">
                {checklist.name}
              </div>
              {showMeta && (
                <div className="text-muted mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  {showPeriodLabel && (
                    <span className="text-default flex items-center gap-1">
                      <Icon icon={Clock} size="xs" decorative />
                      {checklist.periodLabel}
                    </span>
                  )}
                  {showPeriodLabel && showPositions && (
                    <span className="text-muted/40" aria-hidden>
                      ·
                    </span>
                  )}
                  {showPositions ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {checklist.positions.slice(0, 3).map((position) => (
                        <span
                          key={position.id}
                          className="text-muted rounded-full bg-[var(--staffly-control)] px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase"
                        >
                          {position.name || positionNames.get(position.id) || `Должность #${position.id}`}
                        </span>
                      ))}
                      {checklist.positions.length > 3 && (
                        <span className="text-muted rounded-full bg-[var(--staffly-control-hover)] px-2 py-0.5 text-[11px] font-bold">
                          +{checklist.positions.length - 3}
                        </span>
                      )}
                    </div>
                  ) : canManage ? (
                    <span className="text-muted/50 tracking-wide uppercase">—</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          {workSummary && (
            <div className="mt-3 flex flex-wrap items-center gap-2 pl-6">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${workSummary.badgeClassName}`}
              >
                {workSummary.label}
              </span>
              <span className="text-muted text-xs">{workSummary.detail}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage && (
            <ChecklistActionMenu
              checklist={checklist}
              open={isActionMenuOpen}
              downloading={isDownloading}
              canShowHistory={isTrackable}
              onMenuRef={onActionMenuRef}
              onToggle={onToggleActionMenu}
              onDownload={onDownloadJpg}
              onEdit={onEdit}
              onOpenHistory={onOpenHistory}
              onDelete={onDelete}
              onCloseMenu={onCloseActionMenu}
            />
          )}
          <button
            type="button"
            className="text-muted hover:text-default flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[color:var(--staffly-control-hover)]"
            onClick={() => onToggleExpanded(checklist)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Свернуть" : "Открыть"}
          >
            <div
              className={`flex items-center justify-center transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            >
              <Icon icon={ChevronDown} size="sm" />
            </div>
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={PANEL_COLLAPSED}
            animate={PANEL_EXPANDED}
            exit={PANEL_COLLAPSED}
            transition={EXPANDED_PANEL_TRANSITION}
            className="mt-4 overflow-hidden"
          >
            <div className="border-subtle bg-surface text-default rounded-xl border text-sm sm:rounded-2xl">
              {isTrackable ? (
                <TrackableChecklistPanel
                  restaurantId={restaurantId}
                  checklist={checklist}
                  canManage={canManage}
                  itemGroups={itemGroups}
                  activeItemTab={activeItemTab}
                  resetting={isResetting}
                  itemActionLoading={itemActionLoading}
                  photoUploading={photoUploading}
                  onActiveItemTabChange={onActiveItemTabChange}
                  onItemAction={onItemAction}
                  onCompletionPhotoUpload={onCompletionPhotoUpload}
                  onCompletionPhotoDelete={onCompletionPhotoDelete}
                  onReset={onReset}
                  onPhotoPreview={onPhotoPreview}
                />
              ) : (
                <ContentText className="p-4 [overflow-wrap:anywhere]">{checklist.content ?? ""}</ContentText>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

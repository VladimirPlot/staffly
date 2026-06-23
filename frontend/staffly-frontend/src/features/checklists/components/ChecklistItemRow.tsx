import { Camera, Check, Image as ImageIcon, Lock, Unlock, X } from "lucide-react";

import Button from "../../../shared/ui/Button";
import ContentText from "../../../shared/ui/ContentText";
import Icon from "../../../shared/ui/Icon";
import {
  completeChecklistItem,
  reserveChecklistItem,
  undoChecklistItem,
  unreserveChecklistItem,
  type ChecklistDto,
  type ChecklistItemDto,
} from "../api";
import type { PhotoPreview } from "../types";
import { formatDateTime, hasPhoto } from "../utils/formatters";
import ChecklistItemMedia from "./ChecklistItemMedia";

type ChecklistItemRowProps = {
  restaurantId: number;
  checklist: ChecklistDto;
  item: ChecklistItemDto;
  canManage: boolean;
  itemActionLoading: Set<string>;
  isMediaExpanded: boolean;
  isPhotoUploading: boolean;
  onItemAction: (key: string, action: () => Promise<ChecklistDto>) => void;
  onToggleMediaExpanded: (checklistId: number, itemId: number) => void;
  onCompletionPhotoUpload: (checklist: ChecklistDto, item: ChecklistItemDto, file: File) => void;
  onCompletionPhotoDelete: (checklist: ChecklistDto, item: ChecklistItemDto) => void;
  onPhotoPreview: (preview: PhotoPreview) => void;
};

export default function ChecklistItemRow({
  restaurantId,
  checklist,
  item,
  canManage,
  itemActionLoading,
  isMediaExpanded,
  isPhotoUploading,
  onItemAction,
  onToggleMediaExpanded,
  onCompletionPhotoUpload,
  onCompletionPhotoDelete,
  onPhotoPreview,
}: ChecklistItemRowProps) {
  const reserveKey = `${checklist.id}-${item.id}-reserve`;
  const unreserveKey = `${checklist.id}-${item.id}-unreserve`;
  const completeKey = `${checklist.id}-${item.id}-complete`;
  const undoKey = `${checklist.id}-${item.id}-undo`;
  const reserveLoading = itemActionLoading.has(reserveKey);
  const unreserveLoading = itemActionLoading.has(unreserveKey);
  const completeLoading = itemActionLoading.has(completeKey);
  const undoLoading = itemActionLoading.has(undoKey);
  const isBusy = reserveLoading || unreserveLoading || completeLoading || undoLoading;
  const hasExamplePhoto = hasPhoto(item.examplePhotoUrl);
  const hasCompletionPhoto = hasPhoto(item.completionPhotoUrl);
  const missingRequiredPhoto = item.completionPhotoRequired && !hasCompletionPhoto;
  const statusLabel = item.done ? "Готово" : item.reservedBy ? "В работе" : "Свободно";
  const doneByName = item.doneBy?.name ?? "без автора";
  const reservedByName = item.reservedBy?.name ?? "сотрудник";
  const statusClass = item.done
    ? "border-emerald-300 bg-emerald-50 text-default dark:border-emerald-500/45 dark:bg-emerald-500/15"
    : item.reservedBy
      ? "border-amber-300 bg-amber-50 text-default dark:border-amber-500/45 dark:bg-amber-500/15"
      : "border-subtle bg-[color:var(--staffly-control)] text-default";
  const itemRowClass = item.done
    ? "bg-emerald-50/30 dark:bg-emerald-500/[0.06]"
    : item.reservedBy
      ? "bg-amber-50/25 dark:bg-amber-500/[0.06]"
      : "bg-surface";
  const shouldShowMedia = isMediaExpanded || hasExamplePhoto || hasCompletionPhoto || item.completionPhotoRequired;
  const canToggleOptionalMedia = !item.done && !hasExamplePhoto && !hasCompletionPhoto && !item.completionPhotoRequired;

  return (
    <div className={`border-subtle border-b px-2.5 py-3 transition-colors last:border-b-0 sm:px-4 ${itemRowClass}`}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}>{statusLabel}</span>
            {item.completionPhotoRequired && (
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  missingRequiredPhoto
                    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/45 dark:bg-red-500/15 dark:text-red-200"
                    : "text-default border-emerald-300 bg-emerald-50 dark:border-emerald-500/45 dark:bg-emerald-500/15"
                }`}
              >
                {missingRequiredPhoto ? "Нужно фото" : "Фото приложено"}
              </span>
            )}
            {hasExamplePhoto && (
              <span className="border-subtle bg-surface text-default inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                <Icon icon={ImageIcon} size="xs" decorative />
                Есть эталон
              </span>
            )}
          </div>
          <ContentText
            className={`text-[15px] leading-6 [overflow-wrap:anywhere] ${
              item.done ? "text-muted line-through" : "text-strong"
            }`}
          >
            {item.text}
          </ContentText>
          <div className="text-muted mt-1 text-xs">
            {item.done ? (
              <>
                Выполнил: <span className="text-default font-medium">{doneByName}</span>
                {item.doneAt ? ` · ${formatDateTime(item.doneAt)}` : ""}
              </>
            ) : item.reservedBy ? (
              <>
                <span className="text-strong font-semibold">{reservedByName}</span> взял пункт в работу
              </>
            ) : (
              "Можно брать в работу"
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 md:max-w-[9rem] md:justify-self-end">
          {canToggleOptionalMedia && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl shadow-none"
              leftIcon={<Icon icon={isMediaExpanded ? X : Camera} size="sm" decorative />}
              aria-label={isMediaExpanded ? "Свернуть фото" : "Показать фото"}
              title={isMediaExpanded ? "Свернуть фото" : "Показать фото"}
              onClick={() => onToggleMediaExpanded(checklist.id, item.id)}
            />
          )}
          {!item.done && !item.reservedBy && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl shadow-none"
              leftIcon={!reserveLoading ? <Icon icon={Lock} size="sm" decorative /> : undefined}
              aria-label="Взять в работу"
              title="Взять в работу"
              disabled={isBusy}
              isLoading={reserveLoading}
              onClick={() => onItemAction(reserveKey, () => reserveChecklistItem(restaurantId, checklist.id, item.id))}
            />
          )}
          {!item.done && item.reservedBy && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl shadow-none"
              leftIcon={!unreserveLoading ? <Icon icon={Unlock} size="sm" decorative /> : undefined}
              aria-label="Снять бронь"
              title="Снять бронь"
              disabled={isBusy}
              isLoading={unreserveLoading}
              onClick={() =>
                onItemAction(unreserveKey, () => unreserveChecklistItem(restaurantId, checklist.id, item.id))
              }
            />
          )}
          {!item.done && (
            <Button
              size="icon"
              className="h-9 w-9 rounded-xl shadow-none"
              leftIcon={!completeLoading ? <Icon icon={Check} size="sm" decorative /> : undefined}
              aria-label="Отметить как готово"
              title="Отметить как готово"
              disabled={isBusy || missingRequiredPhoto}
              isLoading={completeLoading}
              onClick={() =>
                onItemAction(completeKey, () => completeChecklistItem(restaurantId, checklist.id, item.id))
              }
            />
          )}
          {item.done && canManage && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl shadow-none"
              leftIcon={!undoLoading ? <Icon icon={X} size="sm" decorative /> : undefined}
              aria-label="Снять выполнение"
              title="Снять выполнение"
              disabled={isBusy}
              isLoading={undoLoading}
              onClick={() => onItemAction(undoKey, () => undoChecklistItem(restaurantId, checklist.id, item.id))}
            />
          )}
        </div>
      </div>
      {shouldShowMedia && (
        <ChecklistItemMedia
          checklist={checklist}
          item={item}
          isPhotoUploading={isPhotoUploading}
          onCompletionPhotoUpload={onCompletionPhotoUpload}
          onCompletionPhotoDelete={onCompletionPhotoDelete}
          onPhotoPreview={onPhotoPreview}
        />
      )}
    </div>
  );
}

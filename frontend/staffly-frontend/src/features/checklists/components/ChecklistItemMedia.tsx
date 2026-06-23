import { Camera, Image as ImageIcon } from "lucide-react";

import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import type { ChecklistDto, ChecklistItemDto } from "../api";
import type { PhotoPreview } from "../types";
import { formatDateTime, hasPhoto } from "../utils/formatters";

type ChecklistItemMediaProps = {
  checklist: ChecklistDto;
  item: ChecklistItemDto;
  isPhotoUploading: boolean;
  onCompletionPhotoUpload: (checklist: ChecklistDto, item: ChecklistItemDto, file: File) => void;
  onCompletionPhotoDelete: (checklist: ChecklistDto, item: ChecklistItemDto) => void;
  onPhotoPreview: (preview: PhotoPreview) => void;
};

export default function ChecklistItemMedia({
  checklist,
  item,
  isPhotoUploading,
  onCompletionPhotoUpload,
  onCompletionPhotoDelete,
  onPhotoPreview,
}: ChecklistItemMediaProps) {
  const hasExamplePhoto = hasPhoto(item.examplePhotoUrl);
  const hasCompletionPhoto = hasPhoto(item.completionPhotoUrl);
  const missingRequiredPhoto = item.completionPhotoRequired && !hasCompletionPhoto;

  return (
    <div className="border-subtle mt-3 grid grid-cols-2 gap-2 border-t pt-3 md:gap-3">
      <div className="border-subtle bg-surface rounded-xl border p-2 sm:p-3">
        <div className="text-muted mb-2 flex items-center gap-2 text-xs font-medium">
          <Icon icon={ImageIcon} size="xs" decorative />
          <span>Эталон</span>
        </div>
        {hasExamplePhoto ? (
          <button
            type="button"
            onClick={() =>
              onPhotoPreview({
                title: "Эталон результата",
                description: item.text,
                url: item.examplePhotoUrl!,
              })
            }
            className="group hover:bg-app focus:ring-default flex w-full flex-col gap-2 rounded-lg text-left transition focus:ring-2 focus:outline-none xl:flex-row xl:items-center"
          >
            <img
              src={item.examplePhotoUrl!}
              alt={`Эталон результата: ${item.text}`}
              className="h-20 w-full shrink-0 rounded-lg object-cover sm:h-24 xl:h-20 xl:w-28"
            />
            <span className="min-w-0">
              <span className="text-default block text-xs leading-4 font-medium sm:text-sm">Фото от менеджера</span>
              <span className="text-muted group-hover:text-default mt-0.5 block text-[11px] leading-4 sm:text-xs">
                Открыть крупно
              </span>
            </span>
          </button>
        ) : (
          <div className="border-subtle bg-app/50 text-muted flex min-h-20 items-center gap-2 rounded-lg border border-dashed p-2 text-xs sm:text-sm">
            <Icon icon={ImageIcon} decorative />
            <span>Эталон не добавлен</span>
          </div>
        )}
      </div>
      <div
        className={`rounded-xl border p-2 sm:p-3 ${
          missingRequiredPhoto
            ? "border-red-300 bg-red-50/70 dark:border-red-500/45 dark:bg-red-500/10"
            : "border-subtle bg-surface"
        }`}
      >
        <div className="text-muted mb-2 flex items-center gap-2 text-xs font-medium">
          <Icon icon={Camera} size="xs" decorative />
          <span>Фото выполнения</span>
        </div>
        <div className="flex flex-col gap-2 xl:flex-row">
          {hasCompletionPhoto ? (
            <button
              type="button"
              onClick={() =>
                onPhotoPreview({
                  title: "Фото выполнения",
                  description: item.text,
                  url: item.completionPhotoUrl!,
                })
              }
              className="focus:ring-default shrink-0 rounded-lg focus:ring-2 focus:outline-none"
            >
              <img
                src={item.completionPhotoUrl!}
                alt={`Фото выполнения: ${item.text}`}
                className="h-20 w-full rounded-lg object-cover sm:h-24 xl:h-20 xl:w-28"
              />
            </button>
          ) : (
            <div className="border-subtle bg-app/50 text-muted flex h-20 w-full shrink-0 items-center justify-center rounded-lg border border-dashed sm:h-24 xl:h-20 xl:w-28">
              <Icon icon={Camera} decorative />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-default text-xs leading-4 font-medium sm:text-sm">
              {hasCompletionPhoto ? "Фото прикреплено" : "Фото еще нет"}
            </div>
            <div
              className={`mt-0.5 text-[11px] leading-4 sm:text-xs ${missingRequiredPhoto ? "text-red-700 dark:text-red-200" : "text-muted"}`}
            >
              {hasCompletionPhoto
                ? `${item.completionPhotoUploadedBy?.name || "Сотрудник"} · ${formatDateTime(
                    item.completionPhotoUploadedAt,
                  )}`
                : item.completionPhotoRequired
                  ? "Без фото пункт нельзя закрыть"
                  : "Можно приложить при необходимости"}
            </div>
            {!item.done && (
              <div className="mt-2 flex flex-col gap-2 xl:flex-row xl:flex-wrap">
                <label
                  className={`border-subtle text-default inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border bg-[var(--staffly-control)] px-2 text-sm font-medium transition hover:bg-[var(--staffly-control-hover)] xl:min-h-9 xl:w-auto xl:px-3 ${
                    isPhotoUploading ? "pointer-events-none opacity-60" : ""
                  }`}
                  aria-disabled={isPhotoUploading}
                >
                  <Icon icon={Camera} size="sm" decorative />
                  <span>{hasCompletionPhoto ? "Заменить" : "Прикрепить"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={isPhotoUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void onCompletionPhotoUpload(checklist, item, file);
                      }
                      event.target.value = "";
                    }}
                  />
                </label>
                {hasCompletionPhoto && (
                  <Button
                    type="button"
                    variant="danger-ghost"
                    onClick={() => onCompletionPhotoDelete(checklist, item)}
                    disabled={isPhotoUploading}
                    className="min-h-12 w-full text-sm sm:min-h-9 sm:w-auto"
                  >
                    Удалить
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        {isPhotoUploading && <div className="text-muted mt-2 text-xs">Загружаем фото...</div>}
      </div>
    </div>
  );
}

import { ImagePlus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { readDishwarePhoto } from "../../dishwarePhotoDraft";
import { cn } from "../../../../shared/lib/cn";
import DropdownMenu from "../../../../shared/ui/DropdownMenu";
import Icon from "../../../../shared/ui/Icon";
import type { DishwareInventoryEditableItem } from "../../dishwareInventoryItems";

type PhotoCellProps = {
  item: DishwareInventoryEditableItem;
  index: number;
  uploading: boolean;
  readOnly: boolean;
  compact?: boolean;
  photoMenuOpen: boolean;
  onPhotoMenuOpenChange: (open: boolean) => void;
  onUploadImage: (clientId: string, file: File) => void;
  onViewImage: (clientId: string) => void;
  onDeleteImage: (clientId: string) => void;
};

export default function PhotoCell({
  item,
  index,
  uploading,
  readOnly,
  compact = false,
  photoMenuOpen,
  onPhotoMenuOpenChange,
  onUploadImage,
  onViewImage,
  onDeleteImage,
}: PhotoCellProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let url: string | null = null;
    setPreview(null);
    setPreviewError(null);
    if (item.pendingPhoto)
      void readDishwarePhoto(item.pendingPhoto)
        .then((file) => {
          if (!active) return;
          url = URL.createObjectURL(file);
          setPreview(url);
        })
        .catch((error: unknown) => {
          if (active) setPreviewError(error instanceof Error ? error.message : "Выберите фото повторно");
        });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.pendingPhoto]);
  const photoSrc = item.pendingPhoto ? preview : item.removePhoto ? null : item.photoUrl;
  const hasPhoto = Boolean(item.pendingPhoto || photoSrc);
  const canChange = !readOnly && !uploading;
  const openPicker = () => {
    if (canChange) fileInputRef.current?.click();
  };
  const size = compact ? "h-11 w-11 rounded-lg" : "h-16 w-16 rounded-xl sm:h-[68px] sm:w-[68px]";
  return (
    <div
      className={cn(
        "group/photo relative flex items-center justify-center",
        compact ? "min-h-11" : "min-h-[80px] px-1 py-1.5 sm:min-h-[82px]",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && canChange) onUploadImage(item.clientId, file);
          event.target.value = "";
        }}
      />
      {hasPhoto ? (
        <div className={cn("border-subtle bg-app relative border", size)}>
          <button
            type="button"
            className="h-full w-full overflow-hidden rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
            aria-label={`Открыть фото позиции ${index + 1}`}
            onClick={() => onViewImage(item.clientId)}
          >
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={item.name.trim() || `Фото позиции ${index + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-muted block text-center text-[10px]" title={previewError ?? undefined}>
                {previewError ? "Фото недоступно" : "Готовим фото…"}
              </span>
            )}
          </button>
          {canChange && !compact && (
            <DropdownMenu
              open={photoMenuOpen}
              onOpenChange={onPhotoMenuOpenChange}
              alignClassName="right-0"
              menuClassName="w-9"
              triggerWrapperClassName="absolute right-1 top-1 hidden sm:inline-flex"
              trigger={(triggerProps) => (
                <button
                  type="button"
                  {...triggerProps}
                  aria-label={`Действия с фото позиции ${index + 1}`}
                  title="Действия с фото"
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/40 text-white outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white",
                    photoMenuOpen ? "opacity-100" : "opacity-0 group-hover/photo:opacity-100",
                  )}
                >
                  <Icon icon={MoreVertical} size="xs" decorative />
                </button>
              )}
            >
              {({ close }) => (
                <div className="flex flex-col gap-0.5 p-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    aria-label={`Заменить фото позиции ${index + 1}`}
                    title="Заменить фото"
                    className="text-icon hover:bg-app flex h-8 w-8 items-center justify-center rounded-lg"
                    onClick={() => {
                      close();
                      openPicker();
                    }}
                  >
                    <Icon icon={Pencil} size="xs" decorative />
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    aria-label={`Удалить фото позиции ${index + 1}`}
                    title="Удалить фото"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--staffly-loss-text)]"
                    onClick={() => {
                      close();
                      onDeleteImage(item.clientId);
                    }}
                  >
                    <Icon icon={Trash2} size="xs" decorative />
                  </button>
                </div>
              )}
            </DropdownMenu>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={!canChange}
          title="Добавить фото"
          aria-label={`Добавить фото позиции ${index + 1}`}
          className={cn(
            "border-subtle bg-app text-muted flex items-center justify-center border outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]",
            size,
            canChange && "hover:bg-[color:var(--staffly-control-hover)]",
          )}
          onClick={openPicker}
        >
          <Icon icon={ImagePlus} size="sm" decorative />
        </button>
      )}
      {(uploading || item.pendingPhoto || item.removePhoto) && (
        <span
          className={cn(
            "text-muted absolute rounded bg-[color:var(--staffly-surface)]/95 text-center text-[9px] leading-tight",
            compact ? "inset-x-0 -bottom-3" : "inset-x-2 bottom-0.5",
          )}
        >
          {uploading ? "Фото…" : item.removePhoto ? "Удаление…" : "Фото выбрано"}
        </span>
      )}
    </div>
  );
}

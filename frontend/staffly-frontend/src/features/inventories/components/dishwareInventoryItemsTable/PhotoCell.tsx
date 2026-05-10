import { ImagePlus, MoreVertical, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { useRef } from "react";

import { cn } from "../../../../shared/lib/cn";
import DropdownMenu from "../../../../shared/ui/DropdownMenu";
import Icon from "../../../../shared/ui/Icon";
import type { DishwareInventoryEditableItem } from "../../dishwareInventoryItems";

function PhotoMenuAction({
  children,
  icon,
  onClick,
  tone = "default",
}: {
  children: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "hover:bg-app flex min-h-9 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
        tone === "danger" ? "text-[color:var(--staffly-loss-text)]" : "text-default",
      )}
      onClick={onClick}
    >
      <Icon icon={icon} size="xs" decorative className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

function PhotoMenuIconAction({
  label,
  icon,
  onClick,
  tone = "default",
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-xl transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
        tone === "danger"
          ? "text-[color:var(--staffly-loss-text)] hover:bg-[color:var(--staffly-loss-bg)]"
          : "text-icon hover:bg-app",
      )}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon icon={icon} size="xs" decorative />
    </button>
  );
}

type PhotoCellProps = {
  item: DishwareInventoryEditableItem;
  index: number;
  uploading: boolean;
  readOnly: boolean;
  photoMenuOpen: boolean;
  onPhotoMenuOpenChange: (open: boolean) => void;
  onUploadImage: (itemId: number, file: File) => void;
  onDeleteImage: (itemId: number) => void;
};

export default function PhotoCell({
  item,
  index,
  uploading,
  readOnly,
  photoMenuOpen,
  onPhotoMenuOpenChange,
  onUploadImage,
  onDeleteImage,
}: PhotoCellProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasPhoto = Boolean(item.photoUrl);
  const canChangePhoto = Boolean(item.id) && !readOnly && !uploading;

  const openFilePicker = () => {
    if (!canChangePhoto) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="group/photo relative flex min-h-[80px] items-center justify-center px-1 py-1.5 sm:min-h-[82px]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file || !item.id) return;
          onUploadImage(item.id, file);
          event.target.value = "";
        }}
      />

      {hasPhoto ? (
        <div className="border-subtle bg-app relative h-16 w-16 overflow-hidden rounded-xl border sm:h-[68px] sm:w-[68px]">
          <img
            src={item.photoUrl!}
            alt={item.name.trim() || `Фото позиции ${index + 1}`}
            className="h-full w-full object-cover"
          />

          {canChangePhoto ? (
            <DropdownMenu
              open={photoMenuOpen}
              onOpenChange={onPhotoMenuOpenChange}
              alignClassName="right-0"
              menuClassName="w-9"
              mobileSheetTitle={item.name.trim() || `Позиция ${index + 1}`}
              mobileSheetSubtitle="Фото позиции"
              triggerWrapperClassName="absolute top-2 right-2 inline-flex sm:top-1 sm:right-1"
              trigger={(triggerProps) => (
                <button
                  type="button"
                  className={cn(
                    "relative inline-flex h-7 w-7 touch-manipulation items-center justify-center rounded-lg border border-white/35 bg-black/30 text-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] backdrop-blur-[3px] transition outline-none after:absolute after:-inset-2 after:content-[''] hover:border-white/45 hover:bg-black/42 focus:ring-2 focus:ring-white/80 focus:ring-offset-1 focus:ring-offset-black/20 active:scale-95 sm:h-5 sm:w-5 sm:rounded-md sm:after:-inset-1",
                    photoMenuOpen
                      ? "opacity-100"
                      : "opacity-100 sm:opacity-0 sm:group-hover/photo:opacity-100 sm:focus-visible:opacity-100",
                  )}
                  title="Действия с фото"
                  aria-label={`Действия с фото позиции ${index + 1}`}
                  {...triggerProps}
                >
                  <Icon icon={MoreVertical} size="xs" decorative />
                </button>
              )}
            >
              {({ close, isMobile }) =>
                isMobile ? (
                  <div className="space-y-1 pb-1">
                    <PhotoMenuAction
                      icon={Pencil}
                      onClick={() => {
                        close();
                        window.setTimeout(openFilePicker, 0);
                      }}
                    >
                      Заменить фото
                    </PhotoMenuAction>
                    <PhotoMenuAction
                      icon={Trash2}
                      tone="danger"
                      onClick={() => {
                        close();
                        if (item.id) onDeleteImage(item.id);
                      }}
                    >
                      Удалить фото
                    </PhotoMenuAction>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5 p-0.5">
                    <PhotoMenuIconAction
                      label={`Заменить фото позиции ${index + 1}`}
                      icon={Pencil}
                      onClick={() => {
                        close();
                        window.setTimeout(openFilePicker, 0);
                      }}
                    />
                    <PhotoMenuIconAction
                      label={`Удалить фото позиции ${index + 1}`}
                      icon={Trash2}
                      tone="danger"
                      onClick={() => {
                        close();
                        if (item.id) onDeleteImage(item.id);
                      }}
                    />
                  </div>
                )
              }
            </DropdownMenu>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            "border-subtle bg-app text-muted flex h-16 w-16 items-center justify-center rounded-xl border transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)] sm:h-[68px] sm:w-[68px]",
            canChangePhoto ? "hover:bg-[color:var(--staffly-control-hover)]" : "cursor-default opacity-75",
          )}
          disabled={!canChangePhoto}
          title={item.id ? "Добавить фото" : "Фото можно добавить после сохранения"}
          aria-label={item.id ? `Добавить фото позиции ${index + 1}` : "Фото можно добавить после сохранения"}
          onClick={openFilePicker}
        >
          <Icon icon={ImagePlus} size="sm" decorative />
        </button>
      )}

      {uploading ? (
        <span className="text-muted absolute inset-x-2 bottom-0.5 rounded-full bg-[color:var(--staffly-surface)]/95 px-1 text-center text-[10px] font-medium shadow-sm">
          Фото...
        </span>
      ) : null}
    </div>
  );
}

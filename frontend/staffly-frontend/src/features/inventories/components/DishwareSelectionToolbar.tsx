import { Archive, Edit3, ExternalLink, Folder, MoveRight, Trash2, X } from "lucide-react";

import { cn } from "../../../shared/lib/cn";
import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import type { DishwareInventoryFolderDto } from "../api";
import type { DishwareObject } from "../dishwareInventoriesTypes";

const toolbarButtonClassName =
  "h-8 rounded-full border border-[color:var(--staffly-border)] bg-[color:var(--staffly-surface)]/70 px-2.5 text-xs shadow-none backdrop-blur transition-colors hover:bg-[color:var(--staffly-control-hover)] active:scale-[0.98]";

type DishwareSelectionToolbarProps = {
  object: DishwareObject | null;
  visible: boolean;
  actionLoading: string | null;
  onOpen: (object: DishwareObject) => void;
  onEditFolder: (folder: DishwareInventoryFolderDto) => void;
  onMove: (object: DishwareObject) => void;
  onTrash: (object: DishwareObject) => void;
  onClear: () => void;
};

export default function DishwareSelectionToolbar({
  object,
  visible,
  actionLoading,
  onOpen,
  onEditFolder,
  onMove,
  onTrash,
  onClear,
}: DishwareSelectionToolbarProps) {
  if (!object) return null;

  const isFolder = object.kind === "folder";
  const title = isFolder ? object.folder.name : object.inventory.title;
  const IconComponent = isFolder ? Folder : Archive;
  const trashActionKey = `${isFolder ? "trash-folder" : "trash-inventory"}-${object.id}`;
  const isTrashing = actionLoading === trashActionKey;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-3 bottom-5 z-[60] flex justify-center pb-[env(safe-area-inset-bottom)] transition-opacity duration-150 ease-out motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      )}
      aria-hidden={!visible}
    >
      <section
        data-dishware-selection-toolbar="true"
        className="pointer-events-auto w-auto max-w-full overflow-hidden rounded-[1.5rem] border border-[color:var(--staffly-border)] bg-[color:var(--staffly-surface)]/92 px-2.5 py-2 shadow-[0_12px_34px_rgba(15,23,42,0.12),0_1px_0_rgba(255,255,255,0.75)_inset] backdrop-blur-xl sm:rounded-full"
        aria-label="Действия с выбранным объектом"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5 px-1">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--staffly-control)] text-[color:var(--staffly-text-strong)]">
              <Icon icon={IconComponent} size="sm" decorative />
            </span>
            <span className="min-w-0">
              <span className="text-muted block truncate text-[11px] font-medium">
                {isFolder ? "Папка" : "Документ"} · выбран
              </span>
              <span className="text-strong block truncate text-sm font-semibold" title={title}>
                {title}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:shrink-0 sm:items-center">
            <Button
              size="sm"
              variant="ghost"
              className={toolbarButtonClassName}
              leftIcon={<Icon icon={ExternalLink} size="sm" decorative />}
              onClick={() => onOpen(object)}
            >
              Открыть
            </Button>
            {isFolder ? (
              <Button
                size="sm"
                variant="ghost"
                className={toolbarButtonClassName}
                leftIcon={<Icon icon={Edit3} size="sm" decorative />}
                onClick={() => onEditFolder(object.folder)}
              >
                Изменить
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className={toolbarButtonClassName}
              leftIcon={<Icon icon={MoveRight} size="sm" decorative />}
              onClick={() => onMove(object)}
            >
              Переместить
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(toolbarButtonClassName, "text-red-600")}
              isLoading={isTrashing}
              leftIcon={<Icon icon={Trash2} size="sm" decorative />}
              onClick={() => onTrash(object)}
            >
              В корзину
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(toolbarButtonClassName, "col-span-2 sm:col-span-1")}
              leftIcon={<Icon icon={X} size="sm" decorative />}
              onClick={onClear}
            >
              Снять выбор
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

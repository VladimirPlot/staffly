import { useDroppable } from "@dnd-kit/core";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "../../../shared/lib/cn";
import Icon from "../../../shared/ui/Icon";
import type { DishwareInventoryFolderDto } from "../api";
import { folderDropId } from "../dishwareInventoriesDnd";

function DishwareBreadcrumbFolder({
  folder,
  isCurrent,
  isDragActive,
  disabledDrop,
  isDropCurrentFolder,
  onOpenFolder,
}: {
  folder: DishwareInventoryFolderDto;
  isCurrent: boolean;
  isDragActive: boolean;
  disabledDrop: boolean;
  isDropCurrentFolder: boolean;
  onOpenFolder: (folderId: number) => void;
}) {
  const drop = useDroppable({ id: folderDropId(folder.id), disabled: disabledDrop });

  return (
    <span
      ref={drop.setNodeRef}
      className={cn(
        "inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-transparent transition",
        isDragActive ? "-my-1 min-h-12 px-1.5" : "",
        isDragActive &&
          !disabledDrop &&
          "border-dashed border-[var(--staffly-border)] bg-[color:var(--staffly-control)]/25",
        isDragActive && (disabledDrop || isDropCurrentFolder) && "opacity-60",
        drop.isOver &&
          "border-[var(--staffly-ring)] bg-[var(--staffly-control-hover)] ring-2 ring-[var(--staffly-ring)]/70 ring-inset",
      )}
    >
      <Icon icon={ChevronRight} size="xs" decorative className="text-icon opacity-55" />
      <button
        type="button"
        className={cn(
          "inline-flex max-w-[12rem] shrink-0 items-center border border-transparent font-medium transition focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none focus:ring-inset sm:max-w-[18rem]",
          isDragActive ? "min-h-10 rounded-full px-3" : "h-8 rounded-lg px-1.5",
          isCurrent ? "text-strong" : "text-default",
          !isDragActive && "hover:bg-[var(--staffly-control-hover)]",
          drop.isOver && "text-strong",
        )}
        onClick={() => onOpenFolder(folder.id)}
        title={folder.name}
      >
        <span className="truncate">{folder.name}</span>
      </button>
    </span>
  );
}

export default function DishwareBreadcrumbs({
  currentFolderId,
  folderChain,
  activeObjectId,
  blockedFolderIds,
  onBackToInventories,
  onOpenRoot,
  onOpenFolder,
}: {
  currentFolderId: number | null;
  folderChain: DishwareInventoryFolderDto[];
  activeObjectId: string | null;
  blockedFolderIds: Set<number>;
  onBackToInventories: () => void;
  onOpenRoot: () => void;
  onOpenFolder: (folderId: number) => void;
}) {
  const isDragActive = Boolean(activeObjectId);
  const rootDropDisabled = !isDragActive || currentFolderId == null;
  const rootDrop = useDroppable({ id: folderDropId(null), disabled: rootDropDisabled });

  return (
    <nav
      aria-label="Путь к папке"
      className={cn(
        "text-muted -mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 text-sm transition [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        isDragActive ? "py-2" : "py-1",
      )}
    >
      <Link
        to="/app"
        className="text-default inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-1.5 font-medium transition hover:bg-[var(--staffly-control-hover)] focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none focus:ring-inset"
      >
        <Icon icon={ArrowLeft} size="xs" decorative className="text-icon" />
        Главная
      </Link>
      <Icon icon={ChevronRight} size="xs" decorative className="text-icon shrink-0 opacity-55" />
      <button
        type="button"
        className="text-default h-8 shrink-0 rounded-lg px-1.5 font-medium transition hover:bg-[var(--staffly-control-hover)] focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none focus:ring-inset"
        onClick={onBackToInventories}
      >
        Инвентаризации
      </button>
      <Icon icon={ChevronRight} size="xs" decorative className="text-icon shrink-0 opacity-55" />
      <span
        ref={rootDrop.setNodeRef}
        className={cn(
          "inline-flex shrink-0 items-center rounded-full border border-transparent transition",
          isDragActive ? "-my-1 min-h-12 px-1.5" : "",
          isDragActive &&
            !rootDropDisabled &&
            "border-dashed border-[var(--staffly-border)] bg-[color:var(--staffly-control)]/25",
          isDragActive && rootDropDisabled && "opacity-60",
          rootDrop.isOver &&
            "border-[var(--staffly-ring)] bg-[var(--staffly-control-hover)] ring-2 ring-[var(--staffly-ring)]/70 ring-inset",
        )}
      >
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center border border-transparent font-medium transition focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none focus:ring-inset",
            isDragActive ? "min-h-10 rounded-full px-3" : "h-8 rounded-lg px-1.5",
            currentFolderId == null ? "text-strong" : "text-default",
            !isDragActive && "hover:bg-[var(--staffly-control-hover)]",
            rootDrop.isOver && "text-strong",
          )}
          onClick={onOpenRoot}
        >
          Посуда
        </button>
      </span>
      {folderChain.map((folder, index) => (
        <DishwareBreadcrumbFolder
          key={folder.id}
          folder={folder}
          isCurrent={index === folderChain.length - 1}
          isDragActive={isDragActive}
          disabledDrop={!isDragActive || blockedFolderIds.has(folder.id) || folder.id === currentFolderId}
          isDropCurrentFolder={isDragActive && folder.id === currentFolderId}
          onOpenFolder={onOpenFolder}
        />
      ))}
    </nav>
  );
}

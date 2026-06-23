import { Download, History, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import type { ChecklistDto } from "../api";

type ChecklistActionMenuProps = {
  checklist: ChecklistDto;
  open: boolean;
  downloading: boolean;
  canShowHistory: boolean;
  onMenuRef: (id: number, node: HTMLDivElement | null) => void;
  onToggle: (checklistId: number) => void;
  onDownload: (checklist: ChecklistDto) => void;
  onEdit: (checklist: ChecklistDto) => void;
  onOpenHistory: (checklist: ChecklistDto) => void;
  onDelete: (checklist: ChecklistDto) => void;
  onCloseMenu: () => void;
};

export default function ChecklistActionMenu({
  checklist,
  open,
  downloading,
  canShowHistory,
  onMenuRef,
  onToggle,
  onDownload,
  onEdit,
  onOpenHistory,
  onDelete,
  onCloseMenu,
}: ChecklistActionMenuProps) {
  return (
    <div className="relative" ref={(node) => onMenuRef(checklist.id, node)}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onToggle(checklist.id)}
        disabled={downloading}
        className="text-default min-h-9 min-w-9 sm:min-h-9 sm:min-w-9"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `action-menu-${checklist.id}` : undefined}
        aria-label="Действия с чек-листом"
      >
        <Icon icon={MoreHorizontal} size="sm" />
      </Button>
      {open && (
        <div
          id={`action-menu-${checklist.id}`}
          role="menu"
          className="border-subtle bg-surface absolute right-0 z-10 mt-2 w-48 rounded-2xl border p-1 shadow-[var(--staffly-shadow)]"
        >
          <Button
            variant="ghost"
            size="sm"
            className="text-default w-full justify-start text-sm"
            leftIcon={<Icon icon={Download} size="sm" decorative />}
            onClick={() => onDownload(checklist)}
            disabled={downloading}
            role="menuitem"
          >
            Скачать .jpg
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-default w-full justify-start text-sm"
            leftIcon={<Icon icon={Pencil} size="sm" decorative />}
            onClick={() => {
              onCloseMenu();
              onEdit(checklist);
            }}
            role="menuitem"
          >
            Редактировать
          </Button>
          {canShowHistory && (
            <Button
              variant="ghost"
              size="sm"
              className="text-default w-full justify-start text-sm"
              leftIcon={<Icon icon={History} size="sm" decorative />}
              onClick={() => {
                onCloseMenu();
                void onOpenHistory(checklist);
              }}
              role="menuitem"
            >
              История
            </Button>
          )}
          <Button
            variant="danger-ghost"
            size="sm"
            className="mt-1 w-full justify-start text-sm shadow-none"
            leftIcon={<Icon icon={Trash2} size="sm" decorative />}
            onClick={() => {
              onCloseMenu();
              onDelete(checklist);
            }}
            role="menuitem"
          >
            Удалить
          </Button>
        </div>
      )}
    </div>
  );
}

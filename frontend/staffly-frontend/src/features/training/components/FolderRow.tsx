import { Eye, EyeOff, Folder, Pencil, Trash2 } from "lucide-react";
import { type MouseEvent, useState } from "react";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import type { TrainingFolderDto } from "../api/types";

type Props = {
  folder: TrainingFolderDto;
  canManage: boolean;
  isBusy: boolean;
  onOpen: (folderId: number) => void;
  onEdit: (folder: TrainingFolderDto) => void;
  onHide: (folderId: number) => void;
  onRestore: (folderId: number) => void;
  onDelete: (folderId: number) => void;
};

export default function FolderRow({
  folder,
  canManage,
  isBusy,
  onOpen,
  onEdit,
  onHide,
  onRestore,
  onDelete,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleOpen = () => onOpen(folder.id);

  const stopAnd = (event: MouseEvent, callback: () => void) => {
    event.stopPropagation();
    callback();
  };

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        aria-label={`Открыть папку ${folder.name}`}
        className="group border-subtle bg-surface relative flex h-24 flex-col justify-between gap-3 rounded-3xl border p-4 transition hover:-translate-y-[1px] hover:shadow-md focus-visible:-translate-y-[1px] focus-visible:shadow-md sm:h-auto sm:gap-4 sm:p-6"
        onClick={handleOpen}
        onKeyDown={(event) => {
          if (event.currentTarget !== event.target) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleOpen();
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Иконку папки показываем только на desktop (sm+).
               На мобилке она выглядит как "пустая иконка/квадрат" и не несёт смысла. */}
            <span className="hidden sm:inline-flex">
              <Icon icon={Folder} decorative className="h-6 w-6 text-icon" />
            </span>

            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-strong sm:text-lg">{folder.name}</span>

                <span className="inline-flex rounded-full border border-subtle px-2 py-0.5 text-xs text-muted">
                  {folder.visibilityPositionIds.length === 0
                    ? "Всем"
                    : `${folder.visibilityPositionIds.length} должности`}
                </span>

                {!folder.active && (
                  <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                    Скрыта
                  </span>
                )}
              </div>
            </div>
          </div>

          {canManage && (
            <div className="relative z-10 flex items-center gap-1">
              <IconButton
                aria-label="Редактировать папку"
                title="Редактировать"
                onClick={(event) => stopAnd(event, () => onEdit(folder))}
                disabled={isBusy}
                className="px-2 py-1.5"
              >
                <Icon icon={Pencil} size="sm" />
              </IconButton>

              {folder.active ? (
                <IconButton
                  aria-label="Скрыть папку"
                  title="Скрыть"
                  onClick={(event) => stopAnd(event, () => onHide(folder.id))}
                  disabled={isBusy}
                  className="px-2 py-1.5"
                >
                  <Icon icon={EyeOff} size="sm" />
                </IconButton>
              ) : (
                <IconButton
                  aria-label="Восстановить папку"
                  title="Восстановить"
                  onClick={(event) => stopAnd(event, () => onRestore(folder.id))}
                  disabled={isBusy}
                  className="px-2 py-1.5"
                >
                  <Icon icon={Eye} size="sm" />
                </IconButton>
              )}

              <IconButton
                aria-label={folder.active ? "Скрыть папку" : "Удалить папку навсегда"}
                title={folder.active ? "Скрыть" : "Удалить навсегда"}
                onClick={(event) =>
                  stopAnd(event, () => {
                    if (folder.active) {
                      onHide(folder.id);
                      return;
                    }
                    setConfirmOpen(true);
                  })
                }
                disabled={isBusy}
                className="px-2 py-1.5"
              >
                <Icon icon={Trash2} size="sm" />
              </IconButton>
            </div>
          )}
        </div>

        {folder.description && <div className="hidden text-sm text-muted sm:block">{folder.description}</div>}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Удалить папку навсегда?"
        description="Будут удалены все вложенные папки, карточки и тесты. Действие необратимо."
        confirmText="Удалить"
        confirming={isBusy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          onDelete(folder.id);
          setConfirmOpen(false);
        }}
      />
    </>
  );
}

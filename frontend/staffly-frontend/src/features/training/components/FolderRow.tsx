import { Eye, EyeOff, Folder, Pencil, Trash2 } from "lucide-react";
import { type MouseEvent, useState } from "react";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import type { TrainingFolderDto } from "../api/types";
import { buildVisibilityLabel } from "../utils/visibility";

type Props = {
  folder: TrainingFolderDto;
  canManage: boolean;
  isBusy: boolean;
  positionNameById: Map<number, string>;
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
  positionNameById,
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

  const visibilityLabel = buildVisibilityLabel(folder.visibilityPositionIds, positionNameById);

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        aria-label={`Открыть папку ${folder.name}`}
        className="group border-subtle bg-surface relative flex min-h-24 flex-col gap-3 rounded-3xl border p-4 transition hover:-translate-y-[1px] hover:shadow-md focus-visible:-translate-y-[1px] focus-visible:shadow-md sm:gap-4 sm:p-6"
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
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <span className="hidden pt-0.5 sm:inline-flex">
                <Icon icon={Folder} decorative className="h-6 w-6 text-icon" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3 sm:block">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-strong sm:text-lg [overflow-wrap:anywhere]">
                        {folder.name}
                      </span>

                      {!folder.active && (
                        <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                          Скрыта
                        </span>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="relative z-10 flex shrink-0 items-center gap-1 sm:hidden">
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

                <div className="mt-2 text-xs uppercase tracking-wide leading-relaxed text-muted [overflow-wrap:anywhere]">
                  {visibilityLabel}
                </div>

                {folder.description && (
                  <div className="mt-3 text-sm text-muted [overflow-wrap:anywhere]">
                    {folder.description}
                  </div>
                )}
              </div>
            </div>
          </div>

          {canManage && (
            <div className="relative z-10 hidden shrink-0 items-center gap-1 sm:flex">
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

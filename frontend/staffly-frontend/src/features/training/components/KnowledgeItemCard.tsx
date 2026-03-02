import { Eye, EyeOff, Image, Pencil, Trash2 } from "lucide-react";
import { type MouseEvent, useMemo, useState } from "react";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import Button from "../../../shared/ui/Button";
import type { TrainingKnowledgeItemDto } from "../api/types";

type BusyAction = "hide" | "restore" | "delete" | "save" | null;

type Props = {
  item: TrainingKnowledgeItemDto;
  canManage: boolean;
  busyAction: BusyAction;
  onEdit: (item: TrainingKnowledgeItemDto) => void;
  onHide: (itemId: number) => void; // safe-delete
  onRestore: (itemId: number) => void;
  onDelete: (itemId: number) => void; // hard delete
};

export default function KnowledgeItemCard({
  item,
  canManage,
  busyAction,
  onEdit,
  onHide,
  onRestore,
  onDelete,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isBusy = busyAction !== null;

  const stopAnd = (event: MouseEvent<HTMLElement>, callback: () => void) => {
    event.stopPropagation();
    callback();
  };

  const deleteFlow = useMemo(() => {
    // Активная карточка: "Удалить" = "Скрыть"
    if (item.active) {
      return {
        title: "Удалить карточку?",
        description: "Карточка будет перемещена в скрытые. Удалить навсегда можно будет из скрытых.",
        confirmText: "Удалить",
        confirming: busyAction === "hide",
        action: () => onHide(item.id),
      };
    }

    // Скрытая карточка: "Удалить" = "Удалить навсегда"
    return {
      title: "Удалить карточку навсегда?",
      description: "Действие необратимо. Карточка будет удалена из базы данных, а фото — из хранилища.",
      confirmText: "Удалить",
      confirming: busyAction === "delete",
      action: () => onDelete(item.id),
    };
  }, [item.active, item.id, onDelete, onHide, busyAction]);

  return (
    <>
      <article className="border-subtle bg-surface overflow-hidden rounded-3xl border shadow-[var(--staffly-shadow)]">
        <div className="relative aspect-[16/10] w-full bg-app">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="border-subtle bg-app flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center">
              <Icon icon={Image} size="lg" className="text-icon" decorative />
              <p className="text-sm font-medium text-default">Фото не добавлено</p>
              <p className="text-xs text-muted">Нажмите карандаш, чтобы добавить</p>
            </div>
          )}

          {canManage && (
            <div className="absolute right-1 top-1">
              <DropdownMenu
                disabled={isBusy}
                menuClassName="w-72"
                trigger={(triggerProps) => (
                  <IconButton
                    aria-label="Действия с карточкой"
                    title="Действия"
                    disabled={isBusy}
                    variant="unstyled"
                    className={
                      "h-10 w-10 " +
                      "bg-white/10 backdrop-blur-md border border-white/20 " +
                      "shadow-sm transition " +
                      "hover:bg-white/20 active:bg-white/25 " +
                      "px-0 py-0"
                    }
                    {...triggerProps}
                  >
                    <Icon icon={Pencil} size="sm" className="text-white/90" />
                  </IconButton>
                )}
              >
                {({ close }) => (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-center"
                      disabled={isBusy}
                      onClick={(event) =>
                        stopAnd(event, () => {
                          close();
                          onEdit(item);
                        })
                      }
                    >
                      Редактировать
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-center"
                      disabled={isBusy}
                      onClick={(event) =>
                        stopAnd(event, () => {
                          close();
                          if (item.active) onHide(item.id);
                          else onRestore(item.id);
                        })
                      }
                    >
                      {item.active ? "Скрыть" : "Восстановить"}
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-center"
                      disabled={isBusy}
                      onClick={(event) =>
                        stopAnd(event, () => {
                          close();
                          setConfirmOpen(true);
                        })
                      }
                    >
                      Удалить
                    </Button>
                  </div>
                )}
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h4 className="line-clamp-2 text-base font-semibold text-strong">{item.title}</h4>
            {!item.active && (
              <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                Скрыто
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-xs font-medium text-muted">Описание</div>
              <p className="text-sm text-default">{item.description || "Описание отсутствует."}</p>
            </div>

            <div>
              <div className="text-xs font-medium text-muted">Состав</div>
              <p className="text-sm text-default">{item.composition || "Состав не указан."}</p>
            </div>

            <div>
              <div className="text-xs font-medium text-muted">Аллергены</div>
              <p className="text-sm text-default">{item.allergens || "Аллергены не указаны."}</p>
            </div>
          </div>
        </div>
      </article>

      <ConfirmDialog
        open={confirmOpen}
        title={deleteFlow.title}
        description={deleteFlow.description}
        confirmText={deleteFlow.confirmText}
        confirming={deleteFlow.confirming}
        onCancel={() => {
          if (isBusy) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => {
          deleteFlow.action();
          setConfirmOpen(false);
        }}
      />
    </>
  );
}

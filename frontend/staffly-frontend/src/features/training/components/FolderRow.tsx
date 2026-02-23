import { Folder } from "lucide-react";
import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import type { TrainingFolderDto } from "../api/types";

type Props = {
  folder: TrainingFolderDto;
  canManage: boolean;
  isBusy: boolean;
  onSelect: (folder: TrainingFolderDto) => void;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
};

export default function FolderRow({
  folder,
  canManage,
  isBusy,
  onSelect,
  onHide,
  onRestore,
}: Props) {
  const handleSelect = () => {
    onSelect(folder);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Открыть папку ${folder.name}`}
      className="group border-subtle bg-surface relative flex flex-col gap-3 rounded-3xl border p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md focus-visible:-translate-y-[1px] focus-visible:shadow-md"
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Icon
            icon={Folder}
            decorative
            className="text-icon pointer-events-none absolute right-4 bottom-4 h-12 w-12 opacity-[0.12] sm:pointer-events-auto sm:static sm:h-6 sm:w-6 sm:opacity-100"
          />
          <div className="relative z-10">
            <div className="text-default font-medium">{folder.name}</div>
            {!folder.active && (
              <span className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                Скрыта
              </span>
            )}
          </div>
        </div>
      </div>

      {folder.description && (
        <div className="text-muted hidden text-sm sm:block">{folder.description}</div>
      )}

      {canManage && (
        <div className="relative z-10 flex flex-wrap gap-2 sm:justify-end">
          {folder.active ? (
            <Button
              variant="outline"
              size="sm"
              isLoading={isBusy}
              onClick={(event) => {
                event.stopPropagation();
                onHide(folder.id);
              }}
            >
              Скрыть
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              isLoading={isBusy}
              onClick={(event) => {
                event.stopPropagation();
                onRestore(folder.id);
              }}
            >
              Восстановить
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

import Button from "../../../shared/ui/Button";
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
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-subtle bg-app p-3 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        className="text-left"
        onClick={() => onSelect(folder)}
      >
        <div className="font-medium text-default">{folder.name}</div>
        {folder.description && <div className="text-sm text-muted">{folder.description}</div>}
        {!folder.active && <div className="mt-1 text-xs text-amber-600">Скрыта</div>}
      </button>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled>
            Редактировать
          </Button>
          {folder.active ? (
            <Button variant="outline" size="sm" isLoading={isBusy} onClick={() => onHide(folder.id)}>
              Скрыть
            </Button>
          ) : (
            <Button variant="outline" size="sm" isLoading={isBusy} onClick={() => onRestore(folder.id)}>
              Восстановить
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

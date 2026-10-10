import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import type { ChecklistDto } from "../api";

type DeleteChecklistConfirmDialogProps = {
  target: ChecklistDto | null;
  deleting: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DeleteChecklistConfirmDialog({
  target,
  deleting,
  error,
  onConfirm,
  onCancel,
}: DeleteChecklistConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={Boolean(target)}
      title={target ? `Удалить чек-лист «${target.name}»?` : ""}
      description={error || "Чек-лист будет удалён из рабочего списка. История сохранится."}
      confirming={deleting}
      confirmText="Удалить"
      tone="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

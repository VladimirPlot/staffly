import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import type { ChecklistDto } from "../api";

type DeleteChecklistConfirmDialogProps = {
  target: ChecklistDto | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DeleteChecklistConfirmDialog({
  target,
  deleting,
  onConfirm,
  onCancel,
}: DeleteChecklistConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={Boolean(target)}
      title={target ? `Удалить чек-лист «${target.name}»?` : ""}
      description="Это действие нельзя будет отменить"
      confirming={deleting}
      confirmText="Удалить"
      tone="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

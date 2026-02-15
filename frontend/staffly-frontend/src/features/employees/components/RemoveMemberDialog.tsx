import type { ReactNode } from "react";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";

type RemoveMemberDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmText: string;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function RemoveMemberDialog({
  open,
  title,
  description,
  confirmText,
  confirming,
  onConfirm,
  onCancel,
}: RemoveMemberDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      description={description}
      confirmText={confirmText}
      cancelText="Отмена"
      confirming={confirming}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

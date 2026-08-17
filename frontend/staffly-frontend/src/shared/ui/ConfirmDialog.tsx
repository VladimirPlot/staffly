import React from "react";
import Modal from "./Modal";
import Button from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  tone = "default",
  confirming = false,
  onConfirm,
  onCancel,
}) => {
  const handleClose = React.useCallback(() => {
    if (confirming) return;
    onCancel();
  }, [confirming, onCancel]);

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={handleClose}
      className="max-w-sm"
      footer={
        <div className="w-full grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={confirming}
            className="w-full"
          >
            {cancelText}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={confirming}
            isLoading={confirming}
            className="w-full"
          >
            {confirming ? "Подождите…" : confirmText}
          </Button>
        </div>
      }
    />
  );
};

export default ConfirmDialog;

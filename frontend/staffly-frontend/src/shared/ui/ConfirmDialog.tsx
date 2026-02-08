import React from "react";
import Modal from "./Modal";
import Button from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
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
        <>
          <Button variant="outline" onClick={handleClose} disabled={confirming}>
            {cancelText}
          </Button>
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? "Подождите…" : confirmText}
          </Button>
        </>
      }
    />
  );
};

export default ConfirmDialog;

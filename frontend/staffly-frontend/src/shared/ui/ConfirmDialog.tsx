import React from "react";
import { createPortal } from "react-dom";

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
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirming) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, confirming, onCancel]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !confirming) {
      onCancel();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <div className="text-lg font-semibold text-zinc-900">{title}</div>
        {description && (
          <div className="mt-3 text-sm text-zinc-700">{description}</div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={confirming}
          >
            {cancelText}
          </Button>
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? "Подождите…" : confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;

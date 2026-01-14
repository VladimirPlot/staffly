import React from "react";
import { createPortal } from "react-dom";

import Button from "./Button";
import { getFocusableElements } from "./dialogUtils";

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
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const lastActiveElementRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    lastActiveElementRef.current = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirming) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialogRef.current?.focus();
      }
    }, 0);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, confirming, onCancel]);

  React.useEffect(() => {
    if (!open) return;
    return () => {
      lastActiveElementRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !confirming) {
      onCancel();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (current === first || !dialogRef.current?.contains(current)) {
        event.preventDefault();
        last.focus();
      }
    } else if (current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/30"
      onMouseDown={handleBackdropMouseDown}
    >
      <div className="flex min-h-[100vh] items-center justify-center p-4 supports-[height:100dvh]:min-h-[100dvh]">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="flex w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white shadow-xl max-h-[calc(100vh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]"
        >
          <div className="border-b border-zinc-100 px-6 py-5">
            <div id={titleId} className="text-lg font-semibold text-zinc-900">
              {title}
            </div>
          </div>
          {description && (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div id={descriptionId} className="text-sm text-zinc-700">
                {description}
              </div>
            </div>
          )}
          <div className="border-t border-zinc-100 px-6 py-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel} disabled={confirming}>
                {cancelText}
              </Button>
              <Button onClick={onConfirm} disabled={confirming}>
                {confirming ? "Подождите…" : confirmText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;

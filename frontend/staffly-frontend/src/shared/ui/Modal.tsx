import React from "react";
import { createPortal } from "react-dom";
import Button from "./Button";
import { getFocusableElements } from "./dialogUtils";

type ModalProps = {
  open: boolean;
  title?: string;
  description?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

const Modal: React.FC<ModalProps> = ({
  open,
  title,
  description,
  onClose,
  footer,
  className = "",
  children,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const lastActiveElementRef = React.useRef<HTMLElement | null>(null);

  // держим актуальный onClose без перезапуска эффектов
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    lastActiveElementRef.current = document.activeElement as HTMLElement | null;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", handler);

    const focusTimer = window.setTimeout(() => {
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialogRef.current?.focus();
      }
    }, 0);

    return () => {
      window.removeEventListener("keydown", handler);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    return () => {
      lastActiveElementRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onCloseRef.current();
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
    <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={handleBackdropMouseDown}>
      <div className="flex min-h-[100vh] items-center justify-center p-4 supports-[height:100dvh]:min-h-[100dvh]">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className={`flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-subtle bg-surface shadow-2xl max-h-[calc(100vh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)] ${className}`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-subtle px-6 py-5">
            <div className="min-w-0">
              {title && (
                <div id={titleId} className="text-lg font-semibold text-strong">
                  {title}
                </div>
              )}
              {description && (
                <div id={descriptionId} className="mt-2 text-sm text-muted">
                  {description}
                </div>
              )}
            </div>

            <Button variant="ghost" onClick={() => onCloseRef.current()}>
              Закрыть
            </Button>
          </div>

          {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>}

          {footer && (
            <div className="border-t border-subtle px-6 py-4">
              <div className="flex justify-end gap-2">{footer}</div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;

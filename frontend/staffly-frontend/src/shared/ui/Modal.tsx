import React from "react";
import { createPortal } from "react-dom";

import Button from "./Button";

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
  React.useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div className={`w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl ${className}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && <div className="text-lg font-semibold text-zinc-900">{title}</div>}
            {description && <div className="mt-2 text-sm text-zinc-600">{description}</div>}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
        {children && <div className="mt-4">{children}</div>}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Modal;

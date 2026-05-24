import React from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import CloseButton from "./CloseButton";
import { getFocusableElements } from "./dialogUtils";

type ModalProps = {
  open: boolean;
  title?: string;
  description?: React.ReactNode;
  ariaLabel?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  className?: string;
  headerCloseButton?: boolean;
  headerCloseLabel?: string;
  overlayCloseButton?: boolean;
  overlayCloseLabel?: string;
  children?: React.ReactNode;
};

type BodyScrollLockSnapshot = {
  scrollY: number;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
  boxSizing: string;
};

let bodyScrollLockCount = 0;
let bodyScrollLockSnapshot: BodyScrollLockSnapshot | null = null;

function lockBodyScroll() {
  const body = document.body;
  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

  if (bodyScrollLockCount === 0) {
    const computedBodyStyle = window.getComputedStyle(body);
    const currentPaddingRight = parseFloat(computedBodyStyle.paddingRight) || 0;
    const scrollY = window.scrollY || 0;

    bodyScrollLockSnapshot = {
      scrollY,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
      boxSizing: body.style.boxSizing,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.boxSizing = "border-box";
    body.style.paddingRight = scrollbarWidth > 0 ? `${currentPaddingRight + scrollbarWidth}px` : body.style.paddingRight;
  }

  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount > 0 || !bodyScrollLockSnapshot) return;

  const body = document.body;
  const snapshot = bodyScrollLockSnapshot;
  bodyScrollLockSnapshot = null;

  body.style.position = snapshot.position;
  body.style.top = snapshot.top;
  body.style.left = snapshot.left;
  body.style.right = snapshot.right;
  body.style.width = snapshot.width;
  body.style.paddingRight = snapshot.paddingRight;
  body.style.boxSizing = snapshot.boxSizing;

  window.scrollTo(0, snapshot.scrollY);
}

const Modal: React.FC<ModalProps> = ({
  open,
  title,
  description,
  ariaLabel,
  onClose,
  footer,
  className = "",
  headerCloseButton = false,
  headerCloseLabel = "Закрыть",
  overlayCloseButton = false,
  overlayCloseLabel = "Закрыть",
  children,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const lastActiveElementRef = React.useRef<HTMLElement | null>(null);
  const hasHeader = Boolean(title || description);

  // держим актуальный onClose без перезапуска эффектов
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const titleId = React.useId();
  const descriptionId = React.useId();
  const dialogLabelProps = title
    ? { "aria-labelledby": titleId }
    : ariaLabel
      ? { "aria-label": ariaLabel }
      : {};

  React.useEffect(() => {
    if (!open || typeof window === "undefined") return;

    lockBodyScroll();

    return unlockBodyScroll;
  }, [open]);

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
    if (event.target !== event.currentTarget) return;
    onCloseRef.current();
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
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onMouseDown={handleBackdropMouseDown}
      />
      <div className="pointer-events-none relative flex min-h-[100vh] items-center justify-center p-2 supports-[height:100dvh]:min-h-[100dvh] sm:p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          {...dialogLabelProps}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className={`pointer-events-auto relative w-full max-w-2xl ${className}`}
        >
          {overlayCloseButton && (
            <button
              type="button"
              aria-label={overlayCloseLabel}
              title={overlayCloseLabel}
              onClick={onClose}
              className="text-strong [WebkitTapHighlightColor:transparent] absolute top-0 right-0 z-20 inline-flex h-11 w-11 translate-x-[18%] -translate-y-[18%] items-center justify-center rounded-full border border-white/80 bg-white/88 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-[transform,background-color,box-shadow,color] duration-200 ease-out hover:bg-white hover:shadow-[0_16px_34px_rgba(15,23,42,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--staffly-surface)] active:scale-95 sm:h-12 sm:w-12 sm:translate-x-[22%] sm:-translate-y-[22%]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <X className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" strokeWidth={2.25} />
            </button>
          )}

          <div className="border-subtle bg-surface flex max-h-[calc(100vh-1rem)] w-full flex-col overflow-hidden rounded-[1.75rem] border shadow-2xl supports-[height:100dvh]:max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl sm:supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]">
            {hasHeader && (
              <div className="border-subtle flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-6 sm:py-5">
                <div className="min-w-0">
                  {title && (
                    <div id={titleId} className="text-strong text-lg font-semibold">
                      {title}
                    </div>
                  )}
                  {description && (
                    <div id={descriptionId} className="text-muted mt-2 text-sm">
                      {description}
                    </div>
                  )}
                </div>
                {headerCloseButton && (
                  <CloseButton label={headerCloseLabel} onClick={onClose} />
                )}
              </div>
            )}

            {children && (
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-6 sm:py-4">
                {children}
              </div>
            )}

            {footer && (
              <div className="border-subtle border-t px-3 py-3 sm:px-6 sm:py-4">
                <div className="flex justify-end gap-2">{footer}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;

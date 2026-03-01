import React, { useEffect, useId, useRef, useState } from "react";

type TriggerRenderProps = {
  onClick: (event: React.MouseEvent) => void;
  "aria-expanded": boolean;
  "aria-haspopup": "menu";
  "aria-controls": string;
};

type Props = {
  /**
   * Render trigger element. You receive accessibility props and handlers.
   * Make sure to spread them on the clickable element.
   */
  trigger: (props: TriggerRenderProps) => React.ReactNode;
  /** Menu content. Receive close() to close menu on selection. */
  children: (helpers: { close: () => void }) => React.ReactNode;
  disabled?: boolean;
  /** Menu width classes (Tailwind). */
  menuClassName?: string;
  /** Positioning classes for the menu (Tailwind). Default: right-0 */
  alignClassName?: string;
};

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";
const VIEWPORT_PADDING = 8;

export default function DropdownMenu({
  trigger,
  children,
  disabled = false,
  menuClassName = "w-56",
  alignClassName = "right-0",
}: Props) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [desktopShiftX, setDesktopShiftX] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);

  const desktopMenuId = useId();
  const mobileMenuId = `${desktopMenuId}-sheet`;
  const menuId = isMobile ? mobileMenuId : desktopMenuId;

  const desktopMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);
    return () => mediaQuery.removeEventListener("change", updateIsMobile);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || isMobile) {
      setDesktopShiftX(0);
      return;
    }

    const updateDesktopPosition = () => {
      const menuElement = desktopMenuRef.current;
      if (!menuElement) return;

      const rect = menuElement.getBoundingClientRect();
      let nextShiftX = 0;

      if (rect.left < VIEWPORT_PADDING) {
        nextShiftX = VIEWPORT_PADDING - rect.left;
      } else if (rect.right > window.innerWidth - VIEWPORT_PADDING) {
        nextShiftX = window.innerWidth - VIEWPORT_PADDING - rect.right;
      }

      setDesktopShiftX(nextShiftX);
    };

    updateDesktopPosition();
    window.addEventListener("resize", updateDesktopPosition);
    window.addEventListener("scroll", updateDesktopPosition, true);

    return () => {
      window.removeEventListener("resize", updateDesktopPosition);
      window.removeEventListener("scroll", updateDesktopPosition, true);
    };
  }, [open, isMobile, menuClassName, alignClassName]);

  useEffect(() => {
    if (!open || !isMobile) {
      setSheetVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setSheetVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      setSheetVisible(false);
    };
  }, [open, isMobile]);

  const close = () => setOpen(false);

  return (
    <div className="relative inline-flex">
      {trigger({
        onClick: (event) => {
          event.stopPropagation();
          if (disabled) return;
          setOpen((prev) => !prev);
        },
        "aria-expanded": open,
        "aria-haspopup": "menu",
        "aria-controls": menuId,
      })}

      {open && (
        <>
          {/* Backdrop: closes menu and prevents click-through */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              close();
            }}
            aria-hidden
          />

          {isMobile ? (
            <div
              id={mobileMenuId}
              role="menu"
              className={`bg-surface fixed inset-x-0 bottom-0 z-50 max-h-[min(85vh,640px)] overflow-y-auto rounded-t-3xl border-t p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[var(--staffly-shadow)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
                sheetVisible ? "translate-y-0" : "translate-y-full"
              }`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="bg-border/80 mx-auto mb-4 h-1.5 w-12 rounded-full" aria-hidden />
              {children({ close })}
            </div>
          ) : (
            <div
              id={desktopMenuId}
              ref={desktopMenuRef}
              role="menu"
              className={`border-subtle bg-surface absolute z-50 mt-2 max-w-[calc(100vw-16px)] rounded-2xl border p-1 shadow-[var(--staffly-shadow)] ${alignClassName} ${menuClassName}`}
              style={desktopShiftX === 0 ? undefined : { transform: `translateX(${desktopShiftX}px)` }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {children({ close })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

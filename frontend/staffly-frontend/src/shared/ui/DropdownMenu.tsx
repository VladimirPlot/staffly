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

// Важно: backdrop должен быть выше любых fixed header / navbar.
// Меню — выше backdrop.
const Z_BACKDROP = "z-[1000]";
const Z_MENU = "z-[1010]";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const suppressNextClickRef = useRef(false);

  openRef.current = open;

  useEffect(() => {
    const stopNativeEvent = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if ("stopImmediatePropagation" in event) {
        event.stopImmediatePropagation();
      }
    };

    const isInsideInteractiveLayer = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;

      const rootElement = rootRef.current;
      const menuElement = desktopMenuRef.current;

      if (rootElement?.contains(target)) return true;
      if (menuElement?.contains(target)) return true;

      const mobileSheet = document.getElementById(mobileMenuId);
      if (mobileSheet?.contains(target)) return true;

      return false;
    };

    const onPointerDownCapture = (event: PointerEvent) => {
      if (!openRef.current) return;
      if (isInsideInteractiveLayer(event.target)) return;

      stopNativeEvent(event);
      suppressNextClickRef.current = true;
      setOpen(false);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressNextClickRef.current) return;

      stopNativeEvent(event);
      suppressNextClickRef.current = false;
    };

    document.addEventListener("pointerdown", onPointerDownCapture, true);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [mobileMenuId]);

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
    <div ref={rootRef} className="relative inline-flex">
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
          {/* Backdrop: closes menu and MUST prevent click-through to any UI below it. */}
          <div
            className={`fixed inset-0 ${Z_BACKDROP} bg-black/30 backdrop-blur-[2px]`}
            onPointerDown={(event) => {
              // preventDefault + stopPropagation важны, но главная проблема была в z-index
              event.preventDefault();
              event.stopPropagation();
              close();
            }}
            // на всякий случай, чтобы не было "проброса" click после pointerdown в некоторых случаях
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            aria-hidden
          />

          {isMobile ? (
            <div
              id={mobileMenuId}
              role="menu"
              className={`bg-surface fixed inset-x-0 bottom-0 ${Z_MENU} max-h-[min(85vh,640px)] overflow-y-auto rounded-t-3xl border-t p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[var(--staffly-shadow)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
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
              className={`border-subtle bg-surface absolute ${Z_MENU} mt-2 max-w-[calc(100vw-16px)] rounded-2xl border p-1 shadow-[var(--staffly-shadow)] ${alignClassName} ${menuClassName}`}
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

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TriggerRenderProps = {
  onClick: (event: React.MouseEvent) => void;
  "aria-expanded": boolean;
  "aria-haspopup": "menu";
  "aria-controls": string;
};

type Props = {
  trigger: (props: TriggerRenderProps) => React.ReactNode;
  children: (helpers: { close: () => void; open: boolean; isMobile: boolean }) => React.ReactNode;
  disabled?: boolean;
  menuClassName?: string;
  alignClassName?: string; // оставляем, но для fixed используем только left/right смысл
  triggerWrapperClassName?: string;
  matchTriggerWidth?: boolean;
  mobileSheetTitle?: React.ReactNode;
  mobileSheetSubtitle?: React.ReactNode;
  mobileSheetClassName?: string;
  mobileBackdropClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";
const VIEWPORT_PADDING = 8;
const GAP_Y = 8;
const DESKTOP_MENU_MAX_HEIGHT = "min(24rem, calc(100vh - 16px))";

// Backdrop must be above any fixed header; menu is above backdrop.
const Z_BACKDROP = "z-[1000]";
const Z_MENU = "z-[1010]";

/**
 * DropdownMenu
 * - Desktop: fixed popover (NOT clipped by modal/overflow), closes on outside click
 * - Mobile: bottom sheet + backdrop (overlay) + root lock to prevent click-through on iOS
 */
export default function DropdownMenu({
  trigger,
  children,
  disabled = false,
  menuClassName = "w-56",
  alignClassName = "right-0",
  triggerWrapperClassName = "relative inline-flex",
  matchTriggerWidth = false,
  mobileSheetTitle,
  mobileSheetSubtitle,
  mobileSheetClassName = "",
  mobileBackdropClassName = "",
  open: openProp,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const [isMobile, setIsMobile] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const desktopMenuId = useId();
  const mobileMenuId = `${desktopMenuId}-sheet`;
  const menuId = isMobile ? mobileMenuId : desktopMenuId;

  const triggerWrapRef = useRef<HTMLSpanElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [desktopPos, setDesktopPos] = useState<{ top: number; left: number } | null>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);

  const portalTarget = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.body;
  }, []);

  const setOpen = useCallback((nextOpen: boolean | ((current: boolean) => boolean)) => {
    const resolved = typeof nextOpen === "function" ? nextOpen(open) : nextOpen;

    if (openProp == null) {
      setInternalOpen(resolved);
    }

    onOpenChange?.(resolved);
  }, [onOpenChange, open, openProp]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  // Detect mobile
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);
    return () => mediaQuery.removeEventListener("change", updateIsMobile);
  }, []);

  // ESC closes
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  // ✅ Lock app interactions ONLY for mobile overlay (prevents click-through on iOS)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const shouldLock = open && isMobile;
    if (shouldLock) document.body.classList.add("staffly-overlay-open");
    else document.body.classList.remove("staffly-overlay-open");

    return () => document.body.classList.remove("staffly-overlay-open");
  }, [close, open, isMobile]);

  // ✅ iOS passive listener fix: attach non-passive touch listeners ONLY for mobile overlay
  useEffect(() => {
    if (!open || !isMobile) return;

    const el = backdropRef.current;
    if (!el) return;

    const stop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    el.addEventListener("touchstart", stop, { passive: false });
    el.addEventListener("touchmove", stop, { passive: false });

    return () => {
      el.removeEventListener("touchstart", stop as any);
      el.removeEventListener("touchmove", stop as any);
    };
  }, [close, open, isMobile]);

  // Mobile: animate sheet in
  useEffect(() => {
    if (!open || !isMobile) {
      setSheetVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => setSheetVisible(true));
    return () => {
      window.cancelAnimationFrame(frame);
      setSheetVisible(false);
    };
  }, [close, open, isMobile]);

  // ✅ Desktop: compute fixed position relative to trigger (works inside Modal/overflow)
  useEffect(() => {
    if (!open || isMobile) {
      setDesktopPos(null);
      setTriggerWidth(null);
      return;
    }

    const compute = () => {
      const triggerEl = triggerWrapRef.current;
      const menuEl = desktopMenuRef.current;
      if (!triggerEl || !menuEl) return;

      const t = triggerEl.getBoundingClientRect();
      setTriggerWidth(t.width);

      // menu size (after render)
      const m = menuEl.getBoundingClientRect();
      const menuW = matchTriggerWidth ? t.width : m.width;

      const wantRight = alignClassName.includes("right");

      let left = wantRight ? t.right - menuW : t.left;
      let top = t.bottom + GAP_Y;

      // clamp into viewport
      left = Math.max(
        VIEWPORT_PADDING,
        Math.min(left, window.innerWidth - VIEWPORT_PADDING - menuW),
      );

      // if bottom overflow, try placing above
      const menuH = m.height;
      if (top + menuH > window.innerHeight - VIEWPORT_PADDING) {
        const aboveTop = t.top - GAP_Y - menuH;
        if (aboveTop >= VIEWPORT_PADDING) top = aboveTop;
      }

      setDesktopPos({ top, left });
    };

    // initial + next frame (чтобы размеры меню точно были)
    compute();
    const raf = window.requestAnimationFrame(compute);

    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, isMobile, alignClassName, menuClassName, matchTriggerWidth]);

  // ✅ Desktop: close on outside click (capture)
  useEffect(() => {
    if (!open || isMobile) return;

    const onPointerDownCapture = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const triggerEl = triggerWrapRef.current;
      const menuEl = desktopMenuRef.current;

      if (!target) return;
      if (triggerEl?.contains(target)) return;
      if (menuEl?.contains(target)) return;

      close();
    };

    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [close, open, isMobile]);

  const overlay = !isMobile ? null : (
    <div data-overlay-root="true">
      <div
        ref={backdropRef}
        className={`fixed inset-0 ${Z_BACKDROP} bg-black/20 backdrop-blur-[1px] ${mobileBackdropClassName}`}
        aria-hidden
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
      />

      <div
        id={mobileMenuId}
        role="menu"
        className={`bg-surface fixed inset-x-0 bottom-0 ${Z_MENU} flex max-h-[min(82vh,560px)] flex-col overflow-hidden rounded-t-[1.75rem] border-t border-subtle shadow-[0_-12px_40px_rgba(15,23,42,0.16)] transition-transform duration-300 ease-out motion-reduce:transition-none ${mobileSheetClassName} ${
          sheetVisible ? "translate-y-0" : "translate-y-full"
        }`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex-none px-4 pt-3">
          <div className="bg-border/80 mx-auto mb-3 h-1.5 w-12 rounded-full" aria-hidden />

          {(mobileSheetTitle || mobileSheetSubtitle) && (
            <div className="mb-3 px-1 text-center">
              {mobileSheetTitle && <div className="text-base font-semibold text-default">{mobileSheetTitle}</div>}
              {mobileSheetSubtitle && <div className="mt-1 text-sm leading-5 text-muted">{mobileSheetSubtitle}</div>}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          {children({ close, open, isMobile })}
        </div>
      </div>
    </div>
  );

  return (
    <span ref={triggerWrapRef} className={triggerWrapperClassName}>
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
          {/* ✅ Desktop fixed popover */}
          {!isMobile && (
            <div
              id={desktopMenuId}
              ref={desktopMenuRef}
              role="menu"
              className={`fixed ${Z_MENU} max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto overscroll-contain ${menuClassName}`}
              style={
                desktopPos
                  ? {
                      top: desktopPos.top,
                      left: desktopPos.left,
                      width: matchTriggerWidth && triggerWidth ? triggerWidth : undefined,
                      maxHeight: DESKTOP_MENU_MAX_HEIGHT,
                    }
                  : { top: -9999, left: -9999, maxHeight: DESKTOP_MENU_MAX_HEIGHT } // пока не посчитали — вне экрана
              }
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-subtle bg-surface w-full rounded-[1.5rem] border shadow-[var(--staffly-shadow)]">
                {children({ close, open, isMobile })}
              </div>
            </div>
          )}

          {/* ✅ Mobile overlay in portal (because #root is locked) */}
          {overlay ? (portalTarget ? createPortal(overlay, portalTarget) : overlay) : null}
        </>
      )}
    </span>
  );
}

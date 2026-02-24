import React, { useEffect, useId, useState } from "react";

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

export default function DropdownMenu({
  trigger,
  children,
  disabled = false,
  menuClassName = "w-56",
  alignClassName = "right-0",
}: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

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
          {/*
            Backdrop catches ANY click/tap and prevents "click-through" to UI beneath.
            Use pointerdown so we close before a click is generated.
          */}
          <div
            className="fixed inset-0 z-40"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              close();
            }}
            aria-hidden
          />

          <div
            id={menuId}
            role="menu"
            className={`border-subtle bg-surface absolute z-50 mt-2 rounded-2xl border p-1 shadow-[var(--staffly-shadow)] ${alignClassName} ${menuClassName}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {children({ close })}
          </div>
        </>
      )}
    </div>
  );
}

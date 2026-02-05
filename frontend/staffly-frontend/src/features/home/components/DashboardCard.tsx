import React from "react";
import { useNavigate } from "react-router-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type LucideIcon } from "lucide-react";

type DashboardCardProps = {
  id: string;
  title: string;
  description?: string;
  to: string;
  icon: LucideIcon;
  showIndicator?: boolean;
  isReorderMode: boolean;
  onEnterReorderMode: () => void;
};

const LONG_PRESS_MS = 320;
const MOVE_TOLERANCE_PX = 8;

export default function DashboardCard({
  id,
  title,
  description,
  to,
  icon: Icon,
  showIndicator,
  isReorderMode,
  onEnterReorderMode,
}: DashboardCardProps) {
  const navigate = useNavigate();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // long-press state (only when not in reorder mode)
  const pressTimerRef = React.useRef<number | null>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = React.useRef(false);

  const clearPressTimer = React.useCallback(() => {
    if (pressTimerRef.current != null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      // только primary pointer
      if (e.button !== 0) return;

      // в reorder-mode отдельный long-press не нужен
      if (isReorderMode) return;

      longPressFiredRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };

      clearPressTimer();
      pressTimerRef.current = window.setTimeout(() => {
        longPressFiredRef.current = true;
        onEnterReorderMode();
      }, LONG_PRESS_MS);
    },
    [clearPressTimer, isReorderMode, onEnterReorderMode]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (isReorderMode) return;
      const start = startRef.current;
      if (!start) return;

      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);

      if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) {
        clearPressTimer();
      }
    },
    [clearPressTimer, isReorderMode]
  );

  const onPointerUpOrCancel = React.useCallback(() => {
    clearPressTimer();
    startRef.current = null;
  }, [clearPressTimer]);

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      // если мы в reorder/drag — не навигируем
      if (isReorderMode || isDragging || longPressFiredRef.current) {
        e.preventDefault();
        return;
      }
      navigate(to);
    },
    [isDragging, isReorderMode, navigate, to]
  );

  // Важно: listeners/attributes подключаем ВСЕГДА, иначе dnd-kit не получит pointerdown,
  // и тот же жест “зажал и повёл” не сможет стать drag после delay.
  const dndProps = { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-dashboard-card
      className={isDragging ? "z-10 opacity-80" : undefined}
    >
      <div
        {...dndProps}
        data-dashboard-card
        role="link"
        tabIndex={0}
        className={`dashboard-card-interaction group relative flex h-24 flex-col justify-between gap-3 rounded-3xl border border-subtle bg-surface p-4 transition sm:h-auto sm:gap-4 sm:p-6 ${
          isReorderMode
            ? "shadow-md"
            : "hover:-translate-y-[1px] hover:shadow-md focus-visible:-translate-y-[1px] focus-visible:shadow-md"
        } ${isReorderMode && !isDragging ? "dashboard-jiggle" : ""}`}
        style={{
          // в reorder-mode запрещаем нативный скролл/жесты на карточке — иначе iOS “уводит” страницу
          touchAction: isReorderMode ? "none" : "manipulation",
        }}
        onContextMenu={(event: React.MouseEvent) => event.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUpOrCancel}
        onPointerCancel={onPointerUpOrCancel}
        onClick={handleClick}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            // basic a11y: enter/space navigates only when not reorder/drag
            if (!isReorderMode && !isDragging) navigate(to);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Icon className="h-7 w-7 text-icon sm:h-6 sm:w-6" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900 sm:text-lg">{title}</span>
              {showIndicator && (
                <span
                  className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                  aria-label="Есть новые события"
                />
              )}
            </div>
          </div>
        </div>

        {description && <div className="hidden text-sm text-muted sm:block">{description}</div>}
      </div>
    </div>
  );
}

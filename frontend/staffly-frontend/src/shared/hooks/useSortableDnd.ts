import React from "react";
import { PointerSensor, useSensor, useSensors, type DragMoveEvent, type DragStartEvent } from "@dnd-kit/core";

type SortableDndActivation = "handle" | "long-press";

type UseSortableDndOptions = {
  activation?: SortableDndActivation;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
};

const LONG_PRESS_DELAY_MS = 320;
const LONG_PRESS_TOLERANCE_PX = 8;
const DRAG_DISTANCE_PX = 4;

export function useSortableDnd({ activation = "handle", scrollContainerRef }: UseSortableDndOptions = {}) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const autoScrollStateRef = React.useRef({
    rafId: null as number | null,
    direction: 0,
    speed: 0,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint:
        activation === "long-press"
          ? { delay: LONG_PRESS_DELAY_MS, tolerance: LONG_PRESS_TOLERANCE_PX }
          : { distance: DRAG_DISTANCE_PX },
    }),
  );

  const stopAutoScroll = React.useCallback(() => {
    const state = autoScrollStateRef.current;
    if (state.rafId != null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    state.direction = 0;
    state.speed = 0;
  }, []);

  const startAutoScroll = React.useCallback(
    (direction: number, speed: number) => {
      const state = autoScrollStateRef.current;
      state.direction = direction;
      state.speed = speed;
      if (state.rafId != null) return;

      const step = () => {
        const container = scrollContainerRef?.current;
        if (!container || state.direction === 0 || state.speed === 0) {
          state.rafId = null;
          return;
        }

        const atTop = container.scrollTop <= 0;
        const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
        if ((state.direction < 0 && atTop) || (state.direction > 0 && atBottom)) {
          stopAutoScroll();
          return;
        }

        container.scrollTop += state.direction * state.speed;
        state.rafId = requestAnimationFrame(step);
      };

      state.rafId = requestAnimationFrame(step);
    },
    [scrollContainerRef, stopAutoScroll],
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      const container = scrollContainerRef?.current;
      if (!container) return;

      const activeRect = event.active.rect.current.translated ?? event.active.rect.current.initial;
      if (!activeRect) {
        stopAutoScroll();
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const centerY = (activeRect.top + activeRect.bottom) / 2;
      const distanceToTop = centerY - containerRect.top;
      const distanceToBottom = containerRect.bottom - centerY;
      const edgeThreshold = Math.min(120, containerRect.height * 0.2);
      const maxSpeed = Math.max(8, containerRect.height * 0.02);

      let direction = 0;
      let speed = 0;

      if (distanceToTop < edgeThreshold) {
        direction = -1;
        speed = ((edgeThreshold - distanceToTop) / edgeThreshold) * maxSpeed;
      } else if (distanceToBottom < edgeThreshold) {
        direction = 1;
        speed = ((edgeThreshold - distanceToBottom) / edgeThreshold) * maxSpeed;
      }

      if (direction === 0 || speed === 0) {
        stopAutoScroll();
        return;
      }

      startAutoScroll(direction, speed);
    },
    [scrollContainerRef, startAutoScroll, stopAutoScroll],
  );

  const finishDrag = React.useCallback(() => {
    setActiveId(null);
    stopAutoScroll();
  }, [stopAutoScroll]);

  React.useEffect(() => stopAutoScroll, [stopAutoScroll]);

  return {
    activeId,
    isDragging: activeId !== null,
    sensors,
    handleDragStart,
    handleDragMove,
    finishDrag,
  };
}

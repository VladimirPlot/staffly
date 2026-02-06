import React from "react";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragMoveEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

type UseDashboardDnDOptions = {
  items: string[];
  onChange: (items: string[]) => void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
};

const LONG_PRESS_DELAY_MS = 320;
const LONG_PRESS_TOLERANCE_PX = 8;
const DRAG_DISTANCE_PX = 4;

export function useDashboardDnD({ items, onChange, scrollContainerRef }: UseDashboardDnDOptions) {
  const [isReorderMode, setIsReorderMode] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const autoScrollStateRef = React.useRef({
    rafId: null as number | null,
    direction: 0,
    speed: 0,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isReorderMode
        ? { distance: DRAG_DISTANCE_PX }
        : { delay: LONG_PRESS_DELAY_MS, tolerance: LONG_PRESS_TOLERANCE_PX },
    })
  );

  const handleDragStart = React.useCallback(() => {
    setIsDragging(true);
    // если человек начал тянуть — значит reorder-mode точно включён
    setIsReorderMode(true);
  }, []);

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

        container.scrollTop += state.direction * state.speed;
        state.rafId = requestAnimationFrame(step);
      };

      state.rafId = requestAnimationFrame(step);
    },
    [scrollContainerRef]
  );

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
    [scrollContainerRef, startAutoScroll, stopAutoScroll]
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);

        if (oldIndex !== -1 && newIndex !== -1) {
          onChange(arrayMove(items, oldIndex, newIndex));
        }
      }

      setIsDragging(false);
      stopAutoScroll();
    },
    [items, onChange, stopAutoScroll]
  );

  const handleDragCancel = React.useCallback(() => {
    setIsDragging(false);
    stopAutoScroll();
  }, [stopAutoScroll]);

  return {
    isReorderMode,
    setIsReorderMode,
    isDragging,
    sensors,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  };
}

export type DashboardDnDState = ReturnType<typeof useDashboardDnD>;

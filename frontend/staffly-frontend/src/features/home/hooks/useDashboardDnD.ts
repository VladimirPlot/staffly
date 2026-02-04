import React from "react";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

type UseDashboardDnDOptions = {
  items: string[];
  onChange: (items: string[]) => void;
};

const LONG_PRESS_DELAY_MS = 320;
const LONG_PRESS_TOLERANCE_PX = 6;
const DRAG_DISTANCE_PX = 4;

export function useDashboardDnD({ items, onChange }: UseDashboardDnDOptions) {
  const [isReorderMode, setIsReorderMode] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        ...(isReorderMode
          ? {
              distance: DRAG_DISTANCE_PX,
            }
          : {
              delay: LONG_PRESS_DELAY_MS,
              tolerance: LONG_PRESS_TOLERANCE_PX,
            }),
      },
    })
  );

  const handleDragStart = React.useCallback(() => {
    setIsReorderMode(true);
    setIsDragging(true);
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const nextItems = arrayMove(items, oldIndex, newIndex);
        onChange(nextItems);
      }
      setIsDragging(false);
    },
    [items, onChange]
  );

  const handleDragCancel = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  return {
    isReorderMode,
    setIsReorderMode,
    isDragging,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}

export type DashboardDnDState = ReturnType<typeof useDashboardDnD>;

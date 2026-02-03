import React from "react";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

type UseDashboardDnDOptions = {
  items: string[];
  onChange: (items: string[]) => void;
  onSave: (items: string[]) => void;
};

export function useDashboardDnD({ items, onChange, onSave }: UseDashboardDnDOptions) {
  const [isEditMode, setIsEditMode] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 6,
      },
    })
  );

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      setIsEditMode(true);
    },
    []
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const nextItems = arrayMove(items, oldIndex, newIndex);
        onChange(nextItems);
        onSave(nextItems);
      }
      setIsEditMode(false);
    },
    [items, onChange, onSave]
  );

  const handleDragCancel = React.useCallback(() => {
    setIsEditMode(false);
  }, []);

  return {
    isEditMode,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}

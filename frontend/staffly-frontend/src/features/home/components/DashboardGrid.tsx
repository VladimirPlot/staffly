import React from "react";
import { DndContext } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import type { LucideIcon } from "lucide-react";
import DashboardCard from "./DashboardCard";
import { useDashboardDnD } from "../hooks/useDashboardDnD";

export type DashboardCardItem = {
  id: string;
  title: string;
  description?: string;
  to: string;
  icon: LucideIcon;
  showIndicator?: boolean;
};

type DashboardGridProps = {
  cards: DashboardCardItem[];
  order: string[];
  onOrderChange: (order: string[]) => void;
  onOrderSave: (order: string[]) => void;
};

export default function DashboardGrid({
  cards,
  order,
  onOrderChange,
  onOrderSave,
}: DashboardGridProps) {
  const cardMap = React.useMemo(() => {
    return new Map(cards.map((card) => [card.id, card]));
  }, [cards]);

  const {
    isEditMode,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDashboardDnD({
    items: order,
    onChange: onOrderChange,
    onSave: onOrderSave,
  });

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-3 min-[300px]:grid-cols-2 sm:gap-4">
          {order.map((id) => {
            const card = cardMap.get(id);
            if (!card) return null;
            return (
              <DashboardCard
                key={card.id}
                id={card.id}
                title={card.title}
                description={card.description}
                to={card.to}
                icon={card.icon}
                showIndicator={card.showIndicator}
                isEditMode={isEditMode}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

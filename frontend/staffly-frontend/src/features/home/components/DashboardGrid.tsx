import React from "react";
import { DndContext } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import type { LucideIcon } from "lucide-react";
import DashboardCard from "./DashboardCard";
import type { DashboardDnDState } from "../hooks/useDashboardDnD";

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
  dndState: DashboardDnDState;
};

export default function DashboardGrid({ cards, order, dndState }: DashboardGridProps) {
  const cardMap = React.useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const enterReorderMode = React.useCallback(() => {
    dndState.setIsReorderMode(true);
  }, [dndState]);

  return (
    <DndContext
      sensors={dndState.sensors}
      onDragStart={dndState.handleDragStart}
      onDragEnd={dndState.handleDragEnd}
      onDragCancel={dndState.handleDragCancel}
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
                isReorderMode={dndState.isReorderMode}
                onEnterReorderMode={enterReorderMode}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

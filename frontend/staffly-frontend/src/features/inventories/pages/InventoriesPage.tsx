import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Boxes, ChefHat, GlassWater, GripVertical, PackageOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { cn } from "../../../shared/lib/cn";
import { useSortableDnd } from "../../../shared/hooks/useSortableDnd";
import { useAuth } from "../../../shared/providers/AuthProvider";
import BackToHome from "../../../shared/ui/BackToHome";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import InventoryAccessGuard from "../components/InventoryAccessGuard";
import { type InventorySectionId } from "../api";
import { useInventoryLayout } from "../hooks/useInventoryLayout";

type InventoryCardProps = {
  id: InventorySectionId;
  title: string;
  description: string;
  to?: string;
  icon: typeof Boxes;
  disabled?: boolean;
};

const INVENTORY_CARDS: InventoryCardProps[] = [
  {
    id: "dishware",
    title: "Посуда",
    description: "Инвентаризации посуды.",
    to: "/inventories/dishware",
    icon: PackageOpen,
  },
  {
    id: "bar",
    title: "Бар",
    description: "Отдельный модуль для учета барного инвентаря, стекла и бокалов.",
    icon: GlassWater,
    disabled: true,
  },
  {
    id: "kitchen",
    title: "Кухня",
    description: "Отдельный модуль для учета кухонного инвентаря и расходных позиций.",
    icon: ChefHat,
    disabled: true,
  },
];

function InventoryCard({ id, title, description, to, icon, disabled = false }: InventoryCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const canOpen = Boolean(to && !disabled);

  const content = (
    <Card
      role={canOpen ? "link" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      className={cn(
        "group h-full rounded-[2rem] p-4 transition outline-none sm:p-5",
        isDragging && "relative z-20 opacity-80 shadow-xl",
        canOpen && "cursor-pointer hover:bg-app focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]",
      )}
      onClick={() => {
        if (canOpen) navigate(to!);
      }}
      onKeyDown={(event) => {
        if (!canOpen) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(to!);
        }
      }}
    >
      <div className="flex h-full items-start gap-3 sm:gap-4">
        <div className="bg-app flex size-11 shrink-0 items-center justify-center rounded-2xl sm:size-12">
          <Icon icon={icon} size="md" decorative />
        </div>
        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="text-lg font-semibold text-balance">{title}</div>
              {disabled ? (
                <span className="rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)] px-2 py-0.5 text-[11px] font-medium text-muted">
                  В разработке
                </span>
              ) : null}
            </div>
            <div className="text-pretty text-sm text-muted">{description}</div>
          </div>
        </div>
        <button
          type="button"
          className="border-subtle text-muted hover:text-default hover:bg-app active:bg-app -mr-1 inline-flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-2xl border bg-[color:var(--staffly-surface)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
          aria-label={`Перетащить раздел ${title}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          {...attributes}
          {...listeners}
        >
          <Icon icon={GripVertical} size="sm" decorative />
        </button>
      </div>
    </Card>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {content}
    </div>
  );
}

function orderInventoryCards(layout: InventorySectionId[]) {
  const cardMap = new Map(INVENTORY_CARDS.map((card) => [card.id, card]));
  return layout.map((id) => cardMap.get(id)).filter((card): card is InventoryCardProps => Boolean(card));
}

function AuthorizedInventoriesPage() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const { layout, setLayout, isLoading, loadError, persistLayout } = useInventoryLayout(restaurantId);
  const [saveError, setSaveError] = useState<string | null>(null);
  const sortableDnd = useSortableDnd();
  const cards = useMemo(() => orderInventoryCards(layout), [layout]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    sortableDnd.finishDrag();
    if (!over || active.id === over.id) return;

    const oldIndex = layout.indexOf(active.id as InventorySectionId);
    const newIndex = layout.indexOf(over.id as InventorySectionId);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextLayout = arrayMove(layout, oldIndex, newIndex);
    setLayout(nextLayout);
    setSaveError(null);
    const result = await persistLayout(nextLayout);
    if (!result.ok) {
      setSaveError("Сервер сейчас недоступен, порядок разделов не сохранен.");
    }
  };

  const handleDragCancel = () => {
    sortableDnd.finishDrag();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BackToHome />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-balance">Инвентаризации</h2>
        <div className="text-pretty text-sm text-muted">Выбери раздел и открой нужный рабочий поток.</div>
      </div>

      {isLoading ? <Card className="text-sm text-muted">Загружаем порядок разделов...</Card> : null}
      {!isLoading && loadError ? <Card className="text-sm text-muted">{loadError}</Card> : null}
      {saveError ? <Card className="text-sm text-red-600">{saveError}</Card> : null}

      <DndContext
        sensors={sortableDnd.sensors}
        onDragStart={sortableDnd.handleDragStart}
        onDragMove={sortableDnd.handleDragMove}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={layout} strategy={rectSortingStrategy}>
          <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
            {cards.map((card) => (
              <InventoryCard key={card.id} {...card} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default function InventoriesPage() {
  return (
    <InventoryAccessGuard>
      <AuthorizedInventoriesPage />
    </InventoryAccessGuard>
  );
}

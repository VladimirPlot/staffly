import React from "react";
import { Link } from "react-router-dom";
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
};

export default function DashboardCard({
  id,
  title,
  description,
  to,
  icon: Icon,
  showIndicator,
  isReorderMode,
}: DashboardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Wrapper: React.ElementType = isReorderMode ? "div" : Link;
  const wrapperProps = isReorderMode ? {} : { to };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-dashboard-card
      className={isDragging ? "z-10 opacity-80" : undefined}
    >
      <Wrapper
        {...wrapperProps}
        {...attributes}
        {...listeners}
        className={`group relative flex h-24 flex-col justify-between gap-3 rounded-3xl border border-subtle bg-surface p-4 transition sm:h-auto sm:gap-4 sm:p-6 ${
          isReorderMode
            ? "shadow-md"
            : "hover:-translate-y-[1px] hover:shadow-md focus-visible:-translate-y-[1px] focus-visible:shadow-md"
        } ${isReorderMode && !isDragging ? "dashboard-jiggle" : ""}`}
        style={{ touchAction: "pan-y" }}
        onClick={(event: React.MouseEvent) => {
          if (isReorderMode || isDragging) event.preventDefault();
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
        {description && (
          <div className="hidden text-sm text-muted sm:block">{description}</div>
        )}
      </Wrapper>
    </div>
  );
}

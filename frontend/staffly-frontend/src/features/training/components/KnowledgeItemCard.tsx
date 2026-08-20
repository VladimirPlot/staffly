import { Image } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "../../../shared/lib/cn";
import Icon from "../../../shared/ui/Icon";
import type { TrainingKnowledgeItemDto } from "../api/types";

type Props = {
  item: TrainingKnowledgeItemDto;
  canManage: boolean;
  selected?: boolean;
  dragging?: boolean;
  mediaControls?: ReactNode;
  onSelect?: () => void;
};

export default function KnowledgeItemCard({
  item,
  canManage,
  selected = false,
  dragging = false,
  mediaControls,
  onSelect,
}: Props) {
  const description = item.description?.trim() ?? "";
  const composition = item.composition?.trim() ?? "";
  const allergens = item.allergens?.trim() ?? "";

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onSelect || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onSelect();
  };

  return (
    <article
      data-training-object-card="true"
      role={onSelect ? "option" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-selected={onSelect ? selected : undefined}
      className={cn(
        "border-subtle bg-surface h-full min-w-0 overflow-hidden rounded-3xl border shadow-[var(--staffly-shadow)] transition-[border-color,box-shadow,opacity] outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]",
        selected && "border-[var(--staffly-divider)] ring-2 ring-[var(--staffly-ring)]",
        dragging && "opacity-0",
      )}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-app relative aspect-[16/10] w-full">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Icon icon={Image} size="lg" className="text-icon" decorative />
            <p className="text-default text-sm font-medium">Фото не добавлено</p>
            {canManage ? <p className="text-muted text-xs">Нажмите карандаш, чтобы добавить</p> : null}
          </div>
        )}
        {mediaControls ? (
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-1.5">{mediaControls}</div>
        ) : null}
      </div>

      <div className="flex min-w-0 items-start gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start gap-2">
            <h4 className="text-strong min-w-0 flex-1 text-base font-semibold [overflow-wrap:anywhere]">
              {item.title}
            </h4>
            {!item.active ? (
              <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                Скрыто
              </span>
            ) : null}
          </div>

          {description ? <KnowledgeField label="Описание" value={description} /> : null}
          {composition ? <KnowledgeField label="Состав" value={composition} /> : null}
          {allergens ? <KnowledgeField label="Аллергены" value={allergens} /> : null}
        </div>
      </div>
    </article>
  );
}

function KnowledgeField({ label, value }: { label: string; value: string }) {
  return (
    <section className="min-w-0">
      <h5 className="text-muted text-xs font-medium">{label}</h5>
      <p className="text-default text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">{value}</p>
    </section>
  );
}

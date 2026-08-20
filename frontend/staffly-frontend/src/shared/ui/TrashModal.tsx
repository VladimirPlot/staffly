import React from "react";
import { RotateCcw, Trash2, type LucideIcon } from "lucide-react";

import { cn } from "../lib/cn";
import Button from "./Button";
import Icon from "./Icon";
import Modal from "./Modal";
import SearchBar from "./SearchBar";

export type TrashModalItem<TKind extends string = string, TValue = unknown> = {
  key: string;
  kind: TKind;
  value: TValue;
  typeLabel: string;
  typePluralLabel?: string;
  title: string;
  description?: string | null;
  meta?: string | null;
  icon: LucideIcon;
  restoreActionKey?: string;
  deleteActionKey?: string;
};

type TrashModalProps<TKind extends string = string, TValue = unknown> = {
  open: boolean;
  title?: string;
  items: TrashModalItem<TKind, TValue>[];
  loading: boolean;
  error: string | null;
  actionLoading: string | null;
  emptyText?: string;
  loadingText?: string;
  noResultsText?: string;
  searchPlaceholder?: string;
  onClose: () => void;
  onRestore: (item: TrashModalItem<TKind, TValue>) => void;
  onDelete: (item: TrashModalItem<TKind, TValue>) => void;
  onDeleteAll: () => void;
  showDeleteAll?: boolean;
};

export default function TrashModal<TKind extends string = string, TValue = unknown>({
  open,
  title = "Корзина",
  items,
  loading,
  error,
  actionLoading,
  emptyText = "Корзина пуста.",
  loadingText = "Загружаем корзину...",
  noResultsText = "Ничего не найдено.",
  searchPlaceholder = "Поиск по корзине",
  onClose,
  onRestore,
  onDelete,
  onDeleteAll,
  showDeleteAll = true,
}: TrashModalProps<TKind, TValue>) {
  const [query, setQuery] = React.useState("");
  const [activeKind, setActiveKind] = React.useState<TKind | "all">("all");

  React.useEffect(() => {
    if (open) return;
    setQuery("");
    setActiveKind("all");
  }, [open]);

  const itemCountsByKind = React.useMemo(() => {
    const nextCounts = new Map<TKind, number>();
    items.forEach((item) => nextCounts.set(item.kind, (nextCounts.get(item.kind) ?? 0) + 1));
    return nextCounts;
  }, [items]);

  const filters = React.useMemo(() => {
    const seenKinds = new Set<TKind>();
    const nextFilters = items.reduce<Array<{ kind: TKind; label: string; count: number }>>((acc, item) => {
      if (seenKinds.has(item.kind)) return acc;
      seenKinds.add(item.kind);
      acc.push({
        kind: item.kind,
        label: item.typePluralLabel ?? item.typeLabel,
        count: itemCountsByKind.get(item.kind) ?? 0,
      });
      return acc;
    }, []);

    return [{ kind: "all" as const, label: "Все", count: items.length }, ...nextFilters];
  }, [itemCountsByKind, items]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = React.useMemo(
    () =>
      items.filter((item) => {
        if (activeKind !== "all" && item.kind !== activeKind) return false;
        if (!normalizedQuery) return true;

        const haystack = [item.typeLabel, item.title, item.description, item.meta]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    [activeKind, items, normalizedQuery],
  );

  const groupedVisibleItems = React.useMemo(() => {
    const groups = new Map<TKind, { label: string; items: TrashModalItem<TKind, TValue>[] }>();
    visibleItems.forEach((item) => {
      const group = groups.get(item.kind);
      if (group) {
        group.items.push(item);
        return;
      }

      groups.set(item.kind, {
        label: item.typePluralLabel ?? item.typeLabel,
        items: [item],
      });
    });

    return [...groups.entries()].map(([kind, group]) => ({ kind, ...group }));
  }, [visibleItems]);

  const hasItems = items.length > 0;
  const hasVisibleItems = visibleItems.length > 0;

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      className="max-w-4xl"
      headerCloseButton
      headerCloseLabel="Закрыть корзину"
    >
      <div className="space-y-3">
        {hasItems ? (
          <div className="bg-surface sticky top-0 z-10 space-y-3 border-b border-subtle pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted text-sm">
                {items.length} в корзине
                {visibleItems.length !== items.length ? ` · показано ${visibleItems.length}` : ""}
              </div>
              {showDeleteAll && <Button
                size="sm"
                variant="outline"
                className="w-full text-red-600 sm:w-auto"
                leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                onClick={onDeleteAll}
              >
                Удалить все
              </Button>}
            </div>

            <SearchBar
              label={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              totalCount={items.length}
              resultCount={visibleItems.length}
              countNouns={{ one: "элемент", few: "элемента", many: "элементов" }}
              containerClassName="bg-app"
            />

            <div className="no-scrollbar -m-1 flex gap-2 overflow-x-auto p-1">
              {filters.map((filter) => {
                const selected = activeKind === filter.kind;
                return (
                  <button
                    key={filter.kind}
                    type="button"
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-2 rounded-2xl border px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-default",
                      selected
                        ? "border-[var(--staffly-text-strong)] bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                        : "border-subtle bg-app text-default hover:bg-[var(--staffly-control-hover)]",
                    )}
                    aria-pressed={selected}
                    onClick={() => setActiveKind(filter.kind)}
                  >
                    <span>{filter.label}</span>
                    <span className={cn("text-xs", selected ? "opacity-75" : "text-muted")}>{filter.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {loading ? <div className="text-muted text-sm">{loadingText}</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {!loading && !hasItems ? <div className="text-muted text-sm">{emptyText}</div> : null}
        {!loading && hasItems && !hasVisibleItems ? <div className="text-muted text-sm">{noResultsText}</div> : null}

        {!loading && hasVisibleItems
          ? groupedVisibleItems.map((group) => (
              <section key={group.kind} className="space-y-2">
                <div className="text-muted px-1 text-xs font-semibold tracking-wide uppercase">
                  {group.label} · {group.items.length}
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div key={item.key} className="border-subtle bg-app rounded-2xl border p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-medium">
                            <Icon icon={item.icon} size="sm" decorative />
                            <span className="min-w-0 [overflow-wrap:anywhere]">{item.title}</span>
                          </div>
                          {item.description ? (
                            <div className="text-muted mt-1 line-clamp-2 text-sm">{item.description}</div>
                          ) : null}
                          {item.meta ? <div className="text-muted mt-1 text-sm">{item.meta}</div> : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            title="Восстановить"
                            aria-label={`Восстановить ${item.title}`}
                            isLoading={actionLoading === item.restoreActionKey}
                            leftIcon={<Icon icon={RotateCcw} size="sm" decorative />}
                            onClick={() => onRestore(item)}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 text-red-600"
                            title="Удалить навсегда"
                            aria-label={`Удалить ${item.title} навсегда`}
                            isLoading={actionLoading === item.deleteActionKey}
                            leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                            onClick={() => onDelete(item)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          : null}
      </div>
    </Modal>
  );
}

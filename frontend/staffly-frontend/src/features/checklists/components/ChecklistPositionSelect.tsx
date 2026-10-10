import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import Icon from "../../../shared/ui/Icon";
import type { PositionDto } from "../../dictionaries/api";

type Props = {
  positions: PositionDto[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

export default function ChecklistPositionSelect({ positions, selectedIds, onChange }: Props) {
  const [query, setQuery] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const visiblePositions = positions.filter((position) =>
    position.name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")),
  );
  const selectedLabel =
    selectedIds.length === 0
      ? "Все должности"
      : selectedIds.length === 1
        ? (positions.find((position) => position.id === selectedIds[0])?.name ?? "Выбрана 1 должность")
        : `Выбрано должностей: ${selectedIds.length}`;

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target) && detailsRef.current) {
        detailsRef.current.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.open = false;
        detailsRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="w-full min-w-0 md:max-w-sm">
      <details
        ref={detailsRef}
        className="group relative"
        onToggle={(event) => {
          if (!event.currentTarget.open) setQuery("");
        }}
      >
        <summary
          aria-label={"Фильтр по должностям: " + selectedLabel}
          className="border-subtle bg-surface focus:ring-default flex h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl border px-4 text-sm focus:ring-2 focus:outline-none [&::-webkit-details-marker]:hidden"
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <Icon
            icon={ChevronDown}
            size="xs"
            className="shrink-0 transition-transform group-open:rotate-180"
            decorative
          />
        </summary>
        <div className="border-subtle bg-surface absolute top-full z-30 mt-2 w-full rounded-2xl border p-2 shadow-lg">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти должность…"
            aria-label="Поиск должности"
            className="border-subtle bg-app text-default focus:ring-default mb-2 h-9 w-full rounded-xl border px-3 text-sm focus:ring-2 focus:outline-none"
          />
          <label className="text-default hover:bg-app flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm">
            <input type="checkbox" checked={selectedIds.length === 0} onChange={() => onChange([])} />
            Все должности
          </label>
          <div className="border-subtle mt-1 max-h-60 overflow-y-auto border-t pt-1">
            {visiblePositions.map((position) => (
              <label
                key={position.id}
                className="text-default hover:bg-app flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(position.id)}
                  onChange={() => {
                    const next = selectedIds.includes(position.id)
                      ? selectedIds.filter((id) => id !== position.id)
                      : [...selectedIds, position.id];
                    onChange(next.length === positions.length ? [] : next);
                  }}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">{position.name}</span>
              </label>
            ))}
            {visiblePositions.length === 0 && <div className="text-muted px-2 py-3 text-sm">Должности не найдены</div>}
          </div>
        </div>
      </details>
    </div>
  );
}

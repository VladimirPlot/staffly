import { X } from "lucide-react";

import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import type { PositionDto } from "../../dictionaries/api";
import type { ChecklistViewScope } from "../types";

type ChecklistsToolbarProps = {
  canManage: boolean;
  positions: PositionDto[];
  myPositionId: number | null;
  viewScope: ChecklistViewScope;
  positionFilter: number | null;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onViewScopeChange: (scope: ChecklistViewScope) => void;
  onPositionFilterChange: (positionId: number | null) => void;
  onResetFilter: () => void;
};

export default function ChecklistsToolbar({
  canManage,
  positions,
  myPositionId,
  viewScope,
  positionFilter,
  searchTerm,
  onSearchTermChange,
  onViewScopeChange,
  onPositionFilterChange,
  onResetFilter,
}: ChecklistsToolbarProps) {
  const shouldShowReset =
    positionFilter !== null || searchTerm !== "" || (canManage && myPositionId !== null && viewScope === "all");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <Input
          label="Поиск"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Поиск по названию…"
          className="md:max-w-sm"
        />
        {canManage && myPositionId !== null && (
          <div className="flex gap-2 md:mb-0.5">
            <Button
              size="sm"
              variant={viewScope === "my" ? "primary" : "outline"}
              onClick={() => onViewScopeChange("my")}
            >
              Мои
            </Button>
            <Button
              size="sm"
              variant={viewScope === "all" ? "primary" : "outline"}
              onClick={() => onViewScopeChange("all")}
            >
              Все
            </Button>
          </div>
        )}
        {shouldShowReset && (
          <button
            type="button"
            onClick={onResetFilter}
            className="text-muted hover:text-default flex items-center gap-1 rounded-full border border-transparent p-2 text-sm transition md:mb-1.5"
            aria-label="Сбросить фильтры"
          >
            <Icon icon={X} size="sm" decorative />
            <span>Сбросить</span>
          </button>
        )}
      </div>
      {canManage && viewScope === "all" && positions.length > 0 && (
        <div className="relative">
          <div className="no-scrollbar flex flex-nowrap gap-2 overflow-x-auto py-1 pr-12">
            <button
              type="button"
              onClick={() => onPositionFilterChange(null)}
              className={`inline-flex h-9 shrink-0 items-center justify-center rounded-2xl px-4 text-xs font-semibold shadow-sm transition focus:ring-2 focus:outline-none ${
                positionFilter === null
                  ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                  : "border border-[var(--staffly-border)] bg-[var(--staffly-control)] text-[var(--staffly-text)] hover:bg-[var(--staffly-control-hover)]"
              }`}
            >
              Все должности
            </button>
            {positions.map((position) => (
              <button
                key={position.id}
                type="button"
                onClick={() => onPositionFilterChange(position.id)}
                className={`inline-flex h-9 shrink-0 items-center justify-center rounded-2xl px-4 text-xs font-semibold shadow-sm transition focus:ring-2 focus:outline-none ${
                  positionFilter === position.id
                    ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                    : "border border-[var(--staffly-border)] bg-[var(--staffly-control)] text-[var(--staffly-text)] hover:bg-[var(--staffly-control-hover)]"
                }`}
              >
                {position.name}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-[var(--staffly-surface)] to-transparent" />
        </div>
      )}
    </div>
  );
}

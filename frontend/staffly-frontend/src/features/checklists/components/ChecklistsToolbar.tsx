import { useRef } from "react";
import { Archive, X } from "lucide-react";

import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import type { PositionDto } from "../../dictionaries/api";
import type { ChecklistViewScope } from "../types";
import ChecklistPositionSelect from "./ChecklistPositionSelect";

type ChecklistsToolbarProps = {
  canManage: boolean;
  positions: PositionDto[];
  myPositionId: number | null;
  viewScope: ChecklistViewScope;
  positionFilters: number[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onViewScopeChange: (scope: ChecklistViewScope) => void;
  onPositionFilterChange: (positionIds: number[]) => void;
  onResetFilter: () => void;
  onOpenArchive?: () => void;
};

export default function ChecklistsToolbar({
  canManage,
  positions,
  myPositionId,
  viewScope,
  positionFilters,
  searchTerm,
  onSearchTermChange,
  onViewScopeChange,
  onPositionFilterChange,
  onResetFilter,
  onOpenArchive,
}: ChecklistsToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const showPositionSelect = canManage && viewScope === "all" && positions.length > 0;
  const shouldShowReset = positionFilters.length > 0 || searchTerm !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="relative w-full min-w-0 md:max-w-sm md:flex-1">
          <input
            ref={searchInputRef}
            type="text"
            aria-label="Поиск по названию"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Поиск по названию…"
            className="border-subtle bg-surface text-default focus:ring-default h-10 w-full min-w-0 rounded-2xl border pr-11 pl-4 text-[16px] transition outline-none focus:ring-2 dark:[color-scheme:dark]"
          />
          {searchTerm.length > 0 && (
            <button
              type="button"
              aria-label="Очистить поиск"
              title="Очистить поиск"
              className="text-muted hover:text-strong focus:ring-default absolute top-0 right-0 flex h-10 w-10 items-center justify-center rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => {
                onSearchTermChange("");
                searchInputRef.current?.focus();
              }}
            >
              <Icon icon={X} size="xs" decorative />
            </button>
          )}
        </div>
        {(showPositionSelect || shouldShowReset) && (
          <div className="flex min-w-0 items-end gap-2 md:max-w-md md:flex-1">
            {showPositionSelect && (
              <ChecklistPositionSelect
                positions={positions}
                selectedIds={positionFilters}
                onChange={onPositionFilterChange}
              />
            )}
            {shouldShowReset && (
              <button
                type="button"
                onClick={onResetFilter}
                className="text-muted hover:text-default flex h-10 shrink-0 items-center gap-1 rounded-full border border-transparent px-2 text-sm transition"
                aria-label="Сбросить фильтры"
              >
                <Icon icon={X} size="sm" decorative />
                <span>Сбросить</span>
              </button>
            )}
          </div>
        )}
      </div>
      {((canManage && myPositionId !== null) || onOpenArchive) && (
        <div className="flex items-center justify-between gap-3">
          {canManage && myPositionId !== null && (
            <div className="flex gap-2">
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
          {onOpenArchive && (
            <Button
              size="icon"
              variant="outline"
              onClick={onOpenArchive}
              className="ml-auto h-9 w-9 rounded-xl"
              aria-label="Открыть архив чек-листов"
              title="Архив чек-листов"
              leftIcon={<Icon icon={Archive} size="sm" decorative />}
            />
          )}
        </div>
      )}
    </div>
  );
}

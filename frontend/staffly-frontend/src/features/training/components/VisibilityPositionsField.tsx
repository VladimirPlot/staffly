import { Check, ChevronDown } from "lucide-react";
import type { PositionDto } from "../../dictionaries/api";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import { buildVisibilityLabel } from "../utils/visibility";

type Props = {
  positions: PositionDto[];
  value: number[];
  onChange: (nextValue: number[]) => void;
  parentVisibilityPositionIds?: number[];
  disabled?: boolean;
};

export default function VisibilityPositionsField({
  positions,
  value,
  onChange,
  parentVisibilityPositionIds = [],
  disabled = false,
}: Props) {
  const isParentRestricted = parentVisibilityPositionIds.length > 0;
  const allowedPositionIds = new Set(
    isParentRestricted ? parentVisibilityPositionIds : positions.map((position) => position.id)
  );

  const availablePositions = positions.filter((position) => allowedPositionIds.has(position.id));
  const selectedPositionIds = value.filter((id) => allowedPositionIds.has(id));
  const selectedSet = new Set(selectedPositionIds);
  const positionNameById = new Map(positions.map((position) => [position.id, position.name]));

  const togglePosition = (positionId: number) => {
    if (!allowedPositionIds.has(positionId)) {
      return;
    }

    if (selectedSet.has(positionId)) {
      const nextValue = selectedPositionIds.filter((id) => id !== positionId);
      if (isParentRestricted) {
        onChange(nextValue.length > 0 ? nextValue : [...allowedPositionIds]);
        return;
      }
      onChange(nextValue);
      return;
    }

    onChange([...selectedPositionIds, positionId]);
  };

  const setAll = () => {
    if (!isParentRestricted) {
      onChange([]);
      return;
    }
    onChange([...allowedPositionIds]);
  };

  const triggerLabel = (isParentRestricted
    ? buildVisibilityLabel(selectedPositionIds, positionNameById)
    : buildVisibilityLabel(value, positionNameById)
  ).replace("ВСЕМ", "Всем");

  return (
    <div className="space-y-2">
      <label className="block text-sm text-muted">Кто видит</label>
      <DropdownMenu
        disabled={disabled}
        menuClassName="w-[min(28rem,calc(100vw-1rem))]"
        alignClassName="left-0"
        trigger={(triggerProps) => (
          <button
            type="button"
            className="border-subtle bg-surface focus:ring-default flex h-11 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm text-default transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            {...triggerProps}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted" />
          </button>
        )}
      >
        {() => (
          <div className="space-y-1 p-1">
            {!isParentRestricted && (
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={value.length === 0}
                className="text-default hover:bg-app flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm"
                onClick={setAll}
              >
                <span>Всем</span>
                {value.length === 0 && <Check className="h-4 w-4 text-default" />}
              </button>
            )}

            {availablePositions.map((position) => {
              const checked = selectedSet.has(position.id);
              return (
                <button
                  key={position.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  className="text-default hover:bg-app flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm"
                  onClick={() => togglePosition(position.id)}
                >
                  <span>{position.name}</span>
                  {checked && <Check className="h-4 w-4 text-default" />}
                </button>
              );
            })}
          </div>
        )}
      </DropdownMenu>

      {isParentRestricted && (
        <p className="text-xs text-muted">Доступные должности ограничены родительской папкой.</p>
      )}
    </div>
  );
}

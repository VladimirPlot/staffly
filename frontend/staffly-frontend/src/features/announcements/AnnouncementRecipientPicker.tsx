import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import DropdownMenu from "../../shared/ui/DropdownMenu";
import SearchBar from "../../shared/ui/SearchBar";
import { filterAnnouncementOptions } from "./audience";

type Option = { id: number; name: string; detail?: string };

type Props = {
  label: string;
  options: Option[];
  selectedIds: number[];
  placeholder: string;
  disabled: boolean;
  onChange: (ids: number[]) => void;
  resetOption?: { label: string; selected: boolean; onSelect: () => void };
  compact?: boolean;
};

export default function AnnouncementRecipientPicker({
  label,
  options,
  selectedIds,
  placeholder,
  disabled,
  onChange,
  resetOption,
  compact = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const selected = new Set(selectedIds);
  const filtered = useMemo(() => filterAnnouncementOptions(options, query), [options, query]);
  const selectedOptions = options.filter((option) => selected.has(option.id));
  const title =
    selectedOptions.length > 0
      ? compact
        ? selectedOptions.map((option) => option.name).join(", ")
        : `Выбрано: ${selectedOptions.length}`
      : placeholder;

  return (
    <div ref={anchor} className="min-w-0 space-y-2">
      <div className="text-muted text-sm">{label}</div>
      <DropdownMenu
        disabled={disabled}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        matchTriggerWidth
        positionAnchorRef={anchor}
        alignClassName="left-0"
        menuClassName="w-[min(30rem,calc(100vw-1rem))]"
        mobileSheetTitle={label}
        triggerWrapperClassName="block"
        trigger={(props) => (
          <button
            type="button"
            aria-label={label}
            title={title}
            className="border-subtle bg-surface focus:ring-default flex h-9 w-full items-center justify-between rounded-xl border px-3 text-left text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
            {...props}
          >
            <span className="min-w-0 truncate">{title}</span>
            <ChevronDown className="text-muted ml-3 h-4 w-4 shrink-0" />
          </button>
        )}
      >
        {() => (
          <div className="space-y-2 p-1">
            {resetOption && (
              <button
                type="button"
                disabled={disabled}
                onClick={resetOption.onSelect}
                className="text-default hover:bg-app flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm"
              >
                <span>{resetOption.label}</span>
                {resetOption.selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            )}
            <SearchBar
              label={`Поиск: ${label.toLowerCase()}`}
              value={query}
              onValueChange={setQuery}
              placeholder={label === "Участники" || label === "Исполнители" ? "Имя или фамилия" : "Название должности"}
              disabled={disabled}
            />
            <div className="max-h-[18.75rem] space-y-0.5 overflow-y-auto overscroll-contain pr-1">
              {filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={selected.has(option.id)}
                  disabled={disabled}
                  className="text-default hover:bg-app focus:bg-app flex h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm focus:outline-none"
                  onClick={() =>
                    onChange(
                      selected.has(option.id)
                        ? selectedIds.filter((id) => id !== option.id)
                        : [...selectedIds, option.id],
                    )
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{option.name}</span>
                    {option.detail && <span className="text-muted block truncate text-xs">{option.detail}</span>}
                  </span>
                  {selected.has(option.id) && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-muted px-3 py-4 text-center text-sm">Ничего не найдено</div>
              )}
            </div>
          </div>
        )}
      </DropdownMenu>
      {!compact && selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <span
              key={option.id}
              className="border-subtle bg-app inline-flex max-w-full items-center gap-1 rounded-lg border px-2.5 py-1 text-xs"
            >
              <span className="truncate">{option.name}</span>
              <button
                type="button"
                aria-label={`Убрать ${option.name}`}
                disabled={disabled}
                onClick={() => onChange(selectedIds.filter((id) => id !== option.id))}
                className="focus:ring-default rounded p-0.5 focus:ring-2 focus:outline-none"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

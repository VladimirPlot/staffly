import React, { useId } from "react";
import { Search, X } from "lucide-react";

import { cn } from "../lib/cn";
import Icon from "./Icon";

function formatPlural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

type SearchBarProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> & {
  label?: string;
  value: string;
  onValueChange: (next: string) => void;
  onClear?: () => void;
  totalCount?: number;
  resultCount?: number;
  clearLabel?: string;
  containerClassName?: string;
  inputClassName?: string;
  countClassName?: string;
};

export default function SearchBar({
  label = "Поиск",
  value,
  onValueChange,
  onClear,
  totalCount,
  resultCount,
  clearLabel = "Сбросить поиск",
  className = "",
  containerClassName = "",
  inputClassName = "",
  countClassName = "",
  id,
  disabled,
  placeholder = "Поиск",
  ...rest
}: SearchBarProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hasValue = value.trim().length > 0;
  const handleClear = onClear ?? (() => onValueChange(""));

  const countText =
    typeof totalCount === "number"
      ? hasValue
        ? `Найдено ${resultCount ?? 0} из ${totalCount}`
        : `${totalCount} ${formatPlural(totalCount, "контакт", "контакта", "контактов")}`
      : null;
  const compactCountText =
    typeof totalCount === "number"
      ? hasValue
        ? `${resultCount ?? 0}/${totalCount}`
        : `${totalCount}`
      : null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>

      <div
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-2xl border border-subtle bg-surface px-3 shadow-none",
          containerClassName,
        )}
      >
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2">
          <Icon icon={Search} size="sm" decorative className="shrink-0 text-muted" />
          <input
            id={inputId}
            type="text"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className={cn(
              "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-default outline-none placeholder:text-muted",
              inputClassName,
            )}
            {...rest}
          />
        </div>

        <div className="flex h-9 shrink-0 items-center gap-2">
          {compactCountText && (
            <div
              aria-label={countText ?? undefined}
              title={countText ?? undefined}
              className={cn(
                "inline-flex h-6 min-w-9 items-center justify-center rounded-full border border-subtle px-2 text-[10px] font-medium leading-none tabular-nums text-muted sm:hidden",
                countClassName,
              )}
            >
              {compactCountText}
            </div>
          )}

          {countText && (
            <div
              className={cn(
                "hidden whitespace-nowrap pl-1 text-[11px] font-normal leading-none tabular-nums text-muted/60 sm:block",
                countClassName,
              )}
            >
              <span aria-hidden className="mr-1 text-muted/30">
                •
              </span>
              {countText}
            </div>
          )}

          {hasValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={clearLabel}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-[color:var(--staffly-control-hover)] hover:text-default focus:outline-none focus:ring-2 focus:ring-default"
            >
              <Icon icon={X} size="xs" decorative />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

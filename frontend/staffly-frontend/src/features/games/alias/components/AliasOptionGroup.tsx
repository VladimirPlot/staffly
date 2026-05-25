import type { AliasOption } from "../types";

type AliasOptionGroupProps<T extends string> = {
  title: string;
  options: AliasOption<T>[];
  value: T;
  columns: 3 | 4;
  onChange: (value: T) => void;
};

const gridColumnsClass: Record<AliasOptionGroupProps<string>["columns"], string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
};

const AliasOptionGroup = <T extends string>({ title, options, value, columns, onChange }: AliasOptionGroupProps<T>) => {
  return (
    <div className="space-y-1.5">
      <div className="text-muted text-[11px] font-semibold tracking-wide uppercase">{title}</div>
      <div className={["grid gap-2", gridColumnsClass[columns]].join(" ")}>
        {options.map((option) => {
          const selected = option.id === value;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              title={option.description}
              className={[
                "h-8 cursor-pointer rounded-2xl px-2 text-xs font-medium transition focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none",
                selected
                  ? "border border-[var(--staffly-text-strong)] bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)] shadow-sm"
                  : "text-default border border-[var(--staffly-border)] bg-[var(--staffly-control)] hover:bg-[var(--staffly-control-hover)]",
              ].join(" ")}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AliasOptionGroup;

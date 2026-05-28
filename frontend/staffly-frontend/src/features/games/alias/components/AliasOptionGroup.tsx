import { motion } from "framer-motion";
import type { AliasOption } from "../types";

type AliasOptionGroupProps<T extends string> = {
  title: string;
  options: AliasOption<T>[];
  value: T;
  columns: 3 | 4;
  isCompactLandscape?: boolean;
  onChange: (value: T) => void;
};

const gridColumnsClass: Record<AliasOptionGroupProps<string>["columns"], string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
};
const optionButtonClassName =
  "relative h-8 cursor-pointer rounded-[8px] text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]";
const selectedOptionClassName =
  "absolute inset-0 z-10 rounded-[8px] border border-[var(--staffly-border)]/80 bg-[var(--staffly-surface)] shadow-[0_2px_6px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.4)]";
const optionTransition = { type: "spring", stiffness: 380, damping: 30 } as const;

const AliasOptionGroup = <T extends string>({
  title,
  options,
  value,
  columns,
  isCompactLandscape = false,
  onChange,
}: AliasOptionGroupProps<T>) => {
  return (
    <div className={["alias-option-group", isCompactLandscape ? "shrink-0 space-y-[0.35rem]" : "space-y-2"].join(" ")}>
      <div
        className={[
          "text-muted pl-1 text-[10px] font-bold tracking-wider uppercase select-none",
          isCompactLandscape ? "leading-none" : "",
        ].join(" ")}
      >
        {title}
      </div>
      <div
        className={[
          "relative grid gap-1 rounded-xl border border-[var(--staffly-border)]/40 bg-[var(--staffly-border)]/50 p-1",
          gridColumnsClass[columns],
        ].join(" ")}
      >
        {options.map((option) => {
          const selected = option.id === value;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              aria-label={`${title}: ${option.label}`}
              title={option.description}
              className={[optionButtonClassName, isCompactLandscape ? "h-11 min-h-11" : ""].join(" ")}
              onClick={() => onChange(option.id)}
            >
              <motion.span
                className="relative z-20 block animate-none text-center"
                animate={{ color: selected ? "var(--staffly-text-strong)" : "var(--staffly-muted)" }}
                whileHover={{
                  color: selected ? "var(--staffly-text-strong)" : "var(--staffly-text)",
                }}
                transition={optionTransition}
              >
                {option.label}
              </motion.span>
              {selected && (
                <motion.span
                  layoutId={`active-pill-${title}`}
                  className={selectedOptionClassName}
                  transition={optionTransition}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AliasOptionGroup;

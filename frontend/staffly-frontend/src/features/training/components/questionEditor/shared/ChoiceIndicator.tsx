import { Check } from "lucide-react";

type Props = {
  checked: boolean;
  ariaLabel: string;
  onClick: () => void;
  className?: string;
};

export default function ChoiceIndicator({ checked, ariaLabel, onClick, className = "" }: Props) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={[
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
        className,
      ].join(" ")}
      onClick={onClick}
    >
      <span
        className={[
          "flex h-5 w-5 items-center justify-center rounded-md border-2 transition",
          checked
            ? "border-[var(--staffly-text-strong)] bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
            : "border-[var(--staffly-border)] bg-transparent text-transparent",
        ].join(" ")}
        aria-hidden="true"
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

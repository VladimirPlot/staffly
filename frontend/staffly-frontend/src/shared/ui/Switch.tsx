import React from "react";

type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
};

export default function Switch({ label, className = "", checked, disabled, ...rest }: SwitchProps) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm text-default ${className}`}>
      <span className="relative inline-flex h-6 w-11 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          {...rest}
        />

        {/* track */}
        <span
          className={
            "absolute inset-0 rounded-full border transition " +
            "border-[var(--staffly-border)] " +
            "bg-transparent " +
            "peer-checked:bg-[var(--staffly-text-strong)] " +
            "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--staffly-ring)] " +
            "peer-disabled:opacity-60"
          }
        />

        {/* thumb */}
        <span
          className={
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full transition " +
            "bg-[var(--staffly-surface)] border border-[var(--staffly-border)] shadow-sm " +
            "peer-checked:translate-x-5 " +
            "peer-disabled:opacity-80"
          }
        />
      </span>

      {label ? <span>{label}</span> : null}
    </label>
  );
}

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
        <span className="absolute inset-0 rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)] transition peer-checked:bg-[var(--staffly-text-strong)] peer-disabled:opacity-60" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[var(--staffly-surface)] transition peer-checked:translate-x-5 peer-disabled:opacity-80" />
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  );
}

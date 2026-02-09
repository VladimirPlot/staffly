import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export default function Input({ label, error, className = "", ...rest }: Props) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm text-muted">{label}</span>

      <input
        className={[
          "w-full max-w-full rounded-2xl border bg-surface p-3 text-[16px] text-default",
          "outline-none transition focus:ring-2 focus:ring-default",
          // ✅ нативные элементы (в т.ч. иконка date) подстраиваются под тему
          "dark:[color-scheme:dark]",
          error ? "border-red-500 ring-red-200" : "border-subtle",
          className,
        ].join(" ")}
        {...rest}
      />

      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

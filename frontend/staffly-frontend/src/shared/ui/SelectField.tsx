import React from "react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

export default function SelectField({ label, error, className = "", children, ...rest }: Props) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      <select
        className={[
          "h-10 w-full max-w-full truncate rounded-2xl border bg-surface px-4 pr-10 text-sm text-default",
          "outline-none transition focus:ring-2 focus:ring-default",
          error ? "border-red-500 ring-red-200" : "border-subtle",
          className,
        ].join(" ")}
        {...rest}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

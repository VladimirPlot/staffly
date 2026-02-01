import React from "react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

export default function SelectField({ label, error, className = "", children, ...rest }: Props) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      <select
        className={`w-full max-w-full truncate rounded-2xl border bg-white px-4 pr-10 text-sm h-10 outline-none transition focus:ring-2 ${
          error ? "border-red-500 ring-red-200" : "border-zinc-300 focus:ring-zinc-300"
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

import React from "react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

export default function SelectField({ label, error, className = "", children, ...rest }: Props) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-600">{label}</span>
      <select
        className={`w-full rounded-2xl border p-3 text-base outline-none transition focus:ring-2 ${
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

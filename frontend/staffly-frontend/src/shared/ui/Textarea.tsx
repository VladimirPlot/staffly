import React from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export default function Textarea({ label, error, hint, className = "", ...rest }: Props) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600">{label}</span>
      <textarea
        className={`w-full rounded-2xl border p-3 outline-none transition focus:ring-2 ${
          error ? "border-red-500 ring-red-200" : "border-zinc-300 focus:ring-zinc-300"
        } ${className}`}
        {...rest}
      />
      {hint && !error && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

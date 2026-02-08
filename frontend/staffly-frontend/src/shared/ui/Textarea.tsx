import React from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export default function Textarea({ label, error, hint, className = "", ...rest }: Props) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>

      <textarea
        className={[
          "w-full rounded-2xl border bg-surface p-3 text-[16px] text-default",
          "outline-none transition focus:ring-2 focus:ring-default",
          error ? "border-red-500 ring-red-200" : "border-subtle",
          className,
        ].join(" ")}
        {...rest}
      />

      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

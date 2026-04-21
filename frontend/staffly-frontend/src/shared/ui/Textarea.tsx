import React from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
  labelClassName?: string;
};

export default function Textarea({ label, error, hint, labelClassName, className = "", ...rest }: Props) {
  return (
    <label className="block min-w-0">
      <span className={`text-muted mb-1 block min-w-0 text-sm [overflow-wrap:anywhere] ${labelClassName ?? ""}`}>
        {label}
      </span>

      <textarea
        className={[
          "bg-surface text-default w-full min-w-0 rounded-2xl border p-3 text-[16px] [overflow-wrap:anywhere]",
          "focus:ring-default transition outline-none focus:ring-2",
          error ? "border-red-500 ring-red-200" : "border-subtle",
          className,
        ].join(" ")}
        {...rest}
      />

      {hint && !error && (
        <span className="text-muted mt-1 block min-w-0 text-xs [overflow-wrap:anywhere]">
          {hint}
        </span>
      )}
      {error && (
        <span className="mt-1 block min-w-0 text-xs [overflow-wrap:anywhere] text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

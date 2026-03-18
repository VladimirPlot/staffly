import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export default function Input({ label, error, className = "", ...rest }: Props) {
  return (
    <label className="block min-w-0">
      <span className="text-muted mb-1 block min-w-0 text-sm [overflow-wrap:anywhere]">
        {label}
      </span>

      <input
        className={[
          "bg-surface text-default w-full max-w-full min-w-0 rounded-2xl border p-3 text-[16px]",
          "focus:ring-default transition outline-none focus:ring-2",
          "dark:[color-scheme:dark]",
          error ? "border-red-500 ring-red-200" : "border-subtle",
          className,
        ].join(" ")}
        {...rest}
      />

      {error && (
        <span className="mt-1 block min-w-0 text-xs [overflow-wrap:anywhere] text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

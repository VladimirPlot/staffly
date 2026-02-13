import React from "react";

export default function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;

  return (
    <div
      className={[
        "rounded-3xl border shadow-[var(--staffly-shadow)]",
        "border-[var(--staffly-border)] bg-[var(--staffly-surface)]",
        "p-3 sm:p-6",
        className,
      ].join(" ")}
      {...rest}
    />
  );
}

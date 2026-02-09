import React from "react";

export default function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return (
    <div
      className={[
        "rounded-3xl border p-6 shadow-[var(--staffly-shadow)]",
        "border-[var(--staffly-border)] bg-[var(--staffly-surface)]",
        className,
      ].join(" ")}
      {...rest}
    />
  );
}

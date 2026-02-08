import React from "react";

export default function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return (
    <div
      className={`rounded-3xl border border-subtle bg-surface p-6 shadow-[var(--staffly-shadow)] ${className}`}
      {...rest}
    />
  );
}

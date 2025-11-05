import React from "react";

export default function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return (
    <div
      className={`rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm ${className}`}
      {...rest}
    />
  );
}

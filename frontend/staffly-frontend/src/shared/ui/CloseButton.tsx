import React from "react";
import { X } from "lucide-react";

import { cn } from "../lib/cn";

type CloseButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export default function CloseButton({
  label = "Закрыть",
  className,
  type = "button",
  title,
  ...props
}: CloseButtonProps) {
  const ariaLabel = props["aria-label"] ?? label;

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      title={title ?? label}
      {...props}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition",
        "hover:bg-[var(--staffly-control-hover)] hover:text-default",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]",
        className,
      )}
    >
      <X className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}

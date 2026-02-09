import React from "react";

type ButtonVariant = "primary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
};

export default function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  isLoading = false,
  disabled,
  className = "",
  children,
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition shadow-sm " +
    "focus:outline-none focus:ring-2 " +
    "disabled:cursor-not-allowed disabled:opacity-60";

  const sizes: Record<ButtonSize, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base",
    icon: "h-10 w-10 p-0",
  };

  // ✅ только CSS variables (никаких кастомных utility)
  const styles: Record<ButtonVariant, string> = {
    primary:
      "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)] hover:opacity-90 active:opacity-80 " +
      "focus:ring-[var(--staffly-ring)]",
    ghost:
      "bg-transparent text-[var(--staffly-text)] " +
      "hover:bg-[var(--staffly-control-hover)] " +
      "focus:ring-[var(--staffly-ring)]",
    outline:
      "border text-[var(--staffly-text)] " +
      "border-[var(--staffly-border)] " +
      "bg-[var(--staffly-control)] hover:bg-[var(--staffly-control-hover)] " +
      "focus:ring-[var(--staffly-ring)]",
  };

  const isDisabled = disabled || isLoading;

  return (
    <button
      className={`${base} ${sizes[size]} ${styles[variant]} ${className}`}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? (
        <>
          <span className="h-4 w-4 animate-pulse rounded-full bg-current opacity-40" />
          <span className="truncate">{children}</span>
        </>
      ) : (
        <>
          {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
          {children ? <span className="truncate">{children}</span> : null}
          {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
        </>
      )}
    </button>
  );
}

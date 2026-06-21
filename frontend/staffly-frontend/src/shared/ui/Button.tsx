import React from "react";

type ButtonVariant = "primary" | "ghost" | "outline" | "danger" | "danger-ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
};

const BASE_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-medium leading-none transition shadow-sm " +
  "focus:outline-none focus:ring-2 disabled:cursor-not-allowed";

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "h-10 w-10 p-0",
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)] hover:opacity-90 active:opacity-80 " +
    "focus:ring-[var(--staffly-ring)] disabled:bg-[var(--staffly-control)] disabled:text-[var(--staffly-muted)] " +
    "disabled:hover:opacity-100 disabled:active:opacity-100",
  ghost:
    "bg-transparent text-[var(--staffly-text)] hover:bg-[var(--staffly-control-hover)] " +
    "focus:ring-[var(--staffly-ring)] disabled:text-[var(--staffly-muted)] disabled:hover:bg-transparent",
  outline:
    "border border-[var(--staffly-border)] bg-[var(--staffly-control)] text-[var(--staffly-text)] " +
    "hover:bg-[var(--staffly-control-hover)] focus:ring-[var(--staffly-ring)] " +
    "disabled:border-[var(--staffly-border)] disabled:bg-[var(--staffly-control)] disabled:text-[var(--staffly-muted)] " +
    "disabled:hover:bg-[var(--staffly-control)]",
  danger:
    "border border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 active:bg-red-800 " +
    "focus:ring-red-300 dark:bg-red-500 dark:text-white dark:hover:bg-red-400 dark:active:bg-red-500/90 " +
    "dark:focus:ring-red-400 disabled:border-red-200 disabled:bg-red-100 disabled:text-red-400 " +
    "disabled:hover:border-red-200 disabled:hover:bg-red-100 dark:disabled:border-red-500/20 " +
    "dark:disabled:bg-red-500/10 dark:disabled:text-red-300/60",
  "danger-ghost":
    "border border-red-300 bg-red-100 text-red-700 hover:border-red-400 hover:bg-red-200 hover:text-red-800 " +
    "active:bg-red-200 focus:ring-red-200 disabled:border-red-200 disabled:bg-red-50 disabled:text-red-400 " +
    "disabled:hover:border-red-200 disabled:hover:bg-red-50 disabled:hover:text-red-400 " +
    "dark:border-red-500/45 dark:bg-red-500/20 dark:text-red-100 dark:hover:border-red-400/55 " +
    "dark:hover:bg-red-500/30 dark:hover:text-white dark:focus:ring-red-500/40 " +
    "dark:disabled:border-red-500/20 dark:disabled:bg-red-500/10 dark:disabled:text-red-300/55",
};

export default function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  isLoading = false,
  disabled,
  type = "button",
  className = "",
  children,
  ...rest
}: Props) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      className={`${BASE_BUTTON_CLASS} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
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

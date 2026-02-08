import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

type ButtonVariant = "primary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type LinkButtonProps = Omit<LinkProps, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export default function LinkButton({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  className = "",
  children,
  ...rest
}: LinkButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition shadow-sm " +
    "focus:outline-none focus:ring-2 ring-default";

  const sizes: Record<ButtonSize, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base",
    icon: "h-10 w-10 p-0",
  };

  const styles: Record<ButtonVariant, string> = {
    primary:
      "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)] hover:opacity-90 active:opacity-80",
    ghost: "bg-transparent text-default hover:bg-app",
    outline: "border border-subtle bg-transparent text-default hover:bg-app",
  };

  return (
    <Link className={`${base} ${sizes[size]} ${styles[variant]} ${className}`} {...rest}>
      {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      {children ? <span className="truncate">{children}</span> : null}
      {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
    </Link>
  );
}

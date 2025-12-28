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
    "focus:outline-none focus:ring-2 focus:ring-zinc-300 " +
    "disabled:cursor-not-allowed disabled:opacity-60";

  const sizes: Record<ButtonSize, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base",
    icon: "h-10 w-10 p-0",
  };

  const styles: Record<ButtonVariant, string> = {
    primary: "bg-black text-white hover:opacity-90 active:opacity-80",
    ghost: "bg-transparent hover:bg-zinc-100",
    outline: "border border-zinc-300 hover:bg-zinc-50",
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
          {/* простая “точка-загрузка”, без библиотек */}
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

import React from "react";

export type IconButtonVariant = "default" | "unstyled";

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  badge?: number | null;
  variant?: IconButtonVariant;
};

const IconButton: React.FC<IconButtonProps> = ({
  badge,
  children,
  className,
  variant = "default",
  ...props
}) => {
  const base = "relative inline-flex items-center justify-center rounded-full";

  const styles =
    variant === "default"
      ? [
          "border border-subtle bg-surface px-3 py-2 text-sm font-medium text-icon",
          "shadow-[var(--staffly-shadow)] hover:bg-app",
          "focus:outline-none focus:ring-2 focus:ring-default",
        ].join(" ")
      : [
          // unstyled: оставляем только доступность/фокус
          "focus:outline-none focus:ring-2 focus:ring-default",
        ].join(" ");

  return (
    <button
      type="button"
      {...props}
      className={[base, styles, className ?? ""].join(" ")}
    >
      {children}
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
};

export default IconButton;

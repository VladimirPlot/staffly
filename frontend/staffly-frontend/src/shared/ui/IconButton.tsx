import React from "react";

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  badge?: number | null;
};

const IconButton: React.FC<IconButtonProps> = ({ badge, children, className, ...props }) => (
  <button
    type="button"
    {...props}
    className={[
      "relative inline-flex items-center justify-center rounded-full",
      "border border-subtle bg-surface px-3 py-2 text-sm font-medium text-icon",
      "shadow-[var(--staffly-shadow)] hover:bg-app",
      "focus:outline-none focus:ring-2 focus:ring-default",
      className ?? "",
    ].join(" ")}
  >
    {children}
    {typeof badge === "number" && badge > 0 && (
      <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </button>
);

export default IconButton;

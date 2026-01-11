import React from "react";

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  badge?: number | null;
};

const IconButton: React.FC<IconButtonProps> = ({ badge, children, className, ...props }) => (
  <button
    type="button"
    {...props}
    className={`relative inline-flex items-center justify-center rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 ${
      className ?? ""
    }`}
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

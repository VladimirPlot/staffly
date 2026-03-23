import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export default function HiddenStatusBadge({ children = "Скрыт" }: Props) {
  return (
    <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
      {children}
    </span>
  );
}

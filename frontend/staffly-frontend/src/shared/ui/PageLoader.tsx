import React from "react";

type Props = {
  label?: string;
  /** Сколько ждать перед тем как показать лоадер (чтобы не мигал на быстрых переходах) */
  delayMs?: number;
};

export default function PageLoader({ label = "Загрузка…", delayMs = 200 }: Props) {
  const [show, setShow] = React.useState(delayMs === 0);

  React.useEffect(() => {
    if (delayMs === 0) return;
    const t = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  if (!show) return null;

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <div className="rounded-2xl border border-subtle bg-surface p-4 shadow-[var(--staffly-shadow)]">
        <div className="text-sm font-medium text-strong">Staffly</div>
        <div className="mt-1 text-sm text-muted">{label}</div>

        <div className="mt-4 grid gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-xl bg-app",
        // shimmer
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-gradient-to-r before:from-transparent before:via-[rgba(255,255,255,0.35)] before:to-transparent",
        "before:animate-[shimmer_1.2s_infinite]",
        className,
      ].join(" ")}
    />
  );
}

import { Plus } from "lucide-react";

import { cn } from "../../../../shared/lib/cn";
import Icon from "../../../../shared/ui/Icon";

type FloatingAddButtonProps = {
  progress: number;
  saving: boolean;
  onClick: () => void;
};

export default function FloatingAddButton({ progress, saving, onClick }: FloatingAddButtonProps) {
  const interactive = progress > 0.9 && !saving;
  const translateY = Math.round((1 - progress) * 18);
  const scale = 0.96 + progress * 0.04;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-6 z-[60] flex justify-center pb-[env(safe-area-inset-bottom)] transition-[opacity,transform] duration-150 ease-out [will-change:opacity,transform] motion-reduce:transition-none"
      aria-hidden={!interactive}
      style={{
        opacity: progress,
        transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
      }}
    >
      <button
        type="button"
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--staffly-border)] bg-[color:var(--staffly-surface)] text-[color:var(--staffly-text-strong)] shadow-[0_12px_28px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-[rgba(15,23,42,0.04)] transition outline-none hover:-translate-y-0.5 hover:border-[color:var(--staffly-divider)] hover:shadow-[0_16px_34px_rgba(15,23,42,0.22),0_0_0_1px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] focus:ring-2 focus:ring-[var(--staffly-ring)] focus:ring-offset-2 focus:ring-offset-[var(--staffly-bg)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
          interactive ? "pointer-events-auto" : "pointer-events-none",
        )}
        disabled={saving}
        tabIndex={interactive ? undefined : -1}
        aria-label="Добавить позицию"
        onClick={onClick}
      >
        <Icon icon={Plus} size="sm" decorative />
      </button>
    </div>
  );
}

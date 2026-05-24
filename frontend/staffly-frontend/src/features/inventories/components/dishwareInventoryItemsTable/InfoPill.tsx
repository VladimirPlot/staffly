import { cn } from "../../../../shared/lib/cn";

type InfoPillTone = "default" | "loss" | "gain";

type InfoPillProps = {
  label: string;
  value: string;
  tone?: InfoPillTone;
  title?: string;
};

export default function InfoPill({ label, value, tone = "default", title }: InfoPillProps) {
  return (
    <span
      title={title ?? `${label} ${value}`}
      className={cn(
        "inline-flex min-h-6 max-w-full min-w-0 items-center gap-1 rounded-lg border px-1.5 text-[11px] font-medium tabular-nums",
        tone === "default" && "border-subtle text-default bg-[color:var(--staffly-control)]",
        tone === "loss" &&
          "border-[color:var(--staffly-loss-border)] bg-[color:var(--staffly-loss-bg)] text-[color:var(--staffly-loss-text)]",
        tone === "gain" &&
          "border-[color:var(--staffly-gain-border)] bg-[color:var(--staffly-gain-bg)] text-[color:var(--staffly-gain-text)]",
      )}
    >
      <span className="text-muted shrink-0 font-normal">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
    </span>
  );
}

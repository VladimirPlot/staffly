import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export default function KnowledgeSection({
  title,
  count,
  children,
  disabled = false,
  onCollapse,
}: {
  title: string;
  count: number;
  children: ReactNode;
  disabled?: boolean;
  onCollapse?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-3">
      <h3 id={`${id}-title`} className="border-b border-[var(--staffly-border)] pb-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-content`}
          aria-label={`${expanded ? "Свернуть" : "Развернуть"} блок «${title}»`}
          disabled={disabled}
          className="text-muted focus:ring-default flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-1 text-left text-sm font-semibold tracking-wide uppercase focus-visible:ring-2 disabled:cursor-not-allowed"
          onClick={() => {
            if (expanded) onCollapse?.();
            setExpanded(!expanded);
          }}
        >
          <span>
            {title} <span className="ml-1 text-xs font-normal">{count}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-5 w-5 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "" : "-rotate-90"}`}
          />
        </button>
      </h3>
      <div id={`${id}-content`} hidden={!expanded}>
        {expanded && children}
      </div>
    </section>
  );
}

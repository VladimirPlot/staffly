import Icon from "../../../shared/ui/Icon";
import { LayoutGrid, List } from "lucide-react";

type Props = {
  viewMode: "DETAILED" | "COMPACT";
  onToggleViewMode: (view: "DETAILED" | "COMPACT") => void;
};

export default function MasterScheduleToolbar({ viewMode, onToggleViewMode }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-muted">Планирование ФОТ / LC</div>
      <div className="flex items-center gap-1 rounded-2xl border border-subtle bg-surface p-1">
        <button
          type="button"
          onClick={() => onToggleViewMode("DETAILED")}
          className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition ${
            viewMode === "DETAILED"
              ? "bg-app text-strong shadow-[var(--staffly-shadow)]"
              : "text-default hover:bg-app"
          }`}
        >
          <Icon icon={LayoutGrid} size="xs" />
          DETAILED
        </button>
        <button
          type="button"
          onClick={() => onToggleViewMode("COMPACT")}
          className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition ${
            viewMode === "COMPACT"
              ? "bg-app text-strong shadow-[var(--staffly-shadow)]"
              : "text-default hover:bg-app"
          }`}
        >
          <Icon icon={List} size="xs" />
          COMPACT
        </button>
      </div>
    </div>
  );
}

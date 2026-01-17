import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import { Copy, LayoutGrid, List } from "lucide-react";

type Props = {
  view: "table" | "day";
  onToggleView: (view: "table" | "day") => void;
  onCopy: () => void;
};

export default function MasterScheduleToolbar({ view, onToggleView, onCopy }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-zinc-600">Планирование ФОТ / LC</div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onCopy}>
          <span className="inline-flex items-center gap-2">
            <Icon icon={Copy} size="xs" />
            Копировать
          </span>
        </Button>
        <div className="flex items-center gap-1 rounded-2xl border border-zinc-200 bg-white p-1">
          <button
            type="button"
            onClick={() => onToggleView("day")}
            className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition ${
              view === "day" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <Icon icon={List} size="xs" />
            Day view
          </button>
          <button
            type="button"
            onClick={() => onToggleView("table")}
            className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition ${
              view === "table" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <Icon icon={LayoutGrid} size="xs" />
            Table view
          </button>
        </div>
      </div>
    </div>
  );
}

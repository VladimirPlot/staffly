import Button from "../../../shared/ui/Button";
import type { useScheduleTableZoom } from "../hooks/useScheduleTableZoom";

type Props = ReturnType<typeof useScheduleTableZoom>;

export default function ScheduleTableZoomControls({
  zoom,
  isDefaultZoom,
  minZoom,
  maxZoom,
  zoomStep,
  setZoom,
  showFullPeriod,
  resetZoom,
}: Props) {
  return (
    <div className="border-subtle bg-app rounded-2xl border px-3 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="text-strong shrink-0 text-sm font-medium">Масштаб</span>
        <div className="ml-auto">
          <Button variant="outline" onClick={isDefaultZoom ? showFullPeriod : resetZoom}>
            {isDefaultZoom ? "Показать весь период" : "Обычный вид"}
          </Button>
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 lg:w-64">
          <input
            type="range"
            min={minZoom}
            max={maxZoom}
            step={zoomStep}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Масштаб таблицы графика"
            aria-valuetext={`${zoom}%`}
            className="w-0 min-w-0 flex-1 accent-emerald-600"
          />
          <span className="text-muted w-12 shrink-0 text-right text-sm tabular-nums">{zoom}%</span>
        </div>
      </div>
    </div>
  );
}

import Card from "../../../shared/ui/Card";
import {
  formatCompactInventoryMoney,
  formatCompactInventoryNumber,
  formatInventoryCount,
  formatInventoryLossAmount,
  formatInventoryLossCount,
  type DishwareInventorySummary,
} from "../utils";

type DishwareInventorySummaryProps = {
  summary: DishwareInventorySummary;
};

export default function DishwareInventorySummary({ summary }: DishwareInventorySummaryProps) {
  const hasLoss = summary.lossQty > 0;
  const hasGain = summary.gainQty > 0;
  const metrics = [
    {
      label: "Позиций",
      value: formatInventoryCount(summary.itemCount),
      fullValue: formatInventoryCount(summary.itemCount),
      className: "text-default",
    },
    {
      label: "Недостача",
      value: hasLoss ? formatCompactInventoryNumber(-summary.lossQty) : "0",
      fullValue: formatInventoryLossCount(summary.lossQty),
      className: hasLoss ? "text-rose-600" : "text-default",
    },
    {
      label: "Излишек",
      value: hasGain ? `+${formatCompactInventoryNumber(summary.gainQty)}` : "0",
      fullValue: hasGain ? `+${formatInventoryCount(summary.gainQty)}` : "0",
      className: hasGain ? "text-emerald-700" : "text-default",
    },
    {
      label: "Потери",
      value: formatCompactInventoryMoney(summary.totalLossAmount),
      fullValue: formatInventoryLossAmount(summary.totalLossAmount),
      className: summary.totalLossAmount > 0 ? "text-rose-600" : "text-default",
    },
  ];
  const detailMetrics = [
    { label: "Было", value: summary.previousQty },
    { label: "Докупили", value: summary.incomingQty },
    { label: "Ожидалось", value: summary.expectedQty },
    { label: "Стало", value: summary.currentQty },
    { label: "Позиции с недостачей", value: summary.positionsWithLoss },
  ];

  return (
    <Card className="sticky top-2 z-10 border-[color:var(--staffly-border)] bg-[color:var(--staffly-surface)]/95 px-3 py-2 backdrop-blur">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            title={`${metric.label}: ${metric.fullValue}`}
            className="border-subtle flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-xl border bg-[color:var(--staffly-control)]/40 px-3 py-2"
          >
            <dt className="text-muted shrink-0 text-[11px] font-medium">{metric.label}</dt>
            <dd className={`min-w-0 truncate text-base font-semibold tabular-nums ${metric.className}`}>
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="text-muted mt-1.5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {detailMetrics.map((metric) => (
          <span key={metric.label} className="min-w-0 truncate" title={`${metric.label}: ${formatInventoryCount(metric.value)}`}>
            {metric.label}: {formatCompactInventoryNumber(metric.value)}
          </span>
        ))}
      </div>
    </Card>
  );
}

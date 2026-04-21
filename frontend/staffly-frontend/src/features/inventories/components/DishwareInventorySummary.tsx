import Card from "../../../shared/ui/Card";
import { formatInventoryCount, formatInventoryLossAmount, formatInventoryLossCount, type DishwareInventorySummary } from "../utils";

type DishwareInventorySummaryProps = {
  summary: DishwareInventorySummary;
};

export default function DishwareInventorySummary({ summary }: DishwareInventorySummaryProps) {
  return (
    <Card className="sticky top-2 z-10 border-[color:var(--staffly-border)] bg-[color:var(--staffly-surface)]/95 p-4 backdrop-blur">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <div className="text-muted text-xs">Позиций</div>
          <div className="text-default mt-1 text-xl font-semibold">
            {formatInventoryCount(summary.itemCount)}
          </div>
        </div>
        <div>
          <div className="text-muted text-xs">Потери, шт</div>
          <div className="mt-1 text-xl font-semibold text-red-600">
            {formatInventoryLossCount(summary.lossQty)}
          </div>
        </div>
        <div>
          <div className="text-muted text-xs">Плюс, шт</div>
          <div className="text-default mt-1 text-xl font-semibold">
            {formatInventoryCount(summary.gainQty)}
          </div>
        </div>
        <div>
          <div className="text-muted text-xs">Сумма потерь</div>
          <div className="mt-1 text-xl font-semibold text-red-600">
            {formatInventoryLossAmount(summary.totalLossAmount)}
          </div>
        </div>
      </div>
    </Card>
  );
}

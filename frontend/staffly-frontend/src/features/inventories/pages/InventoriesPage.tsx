import { Boxes, ChefHat, GlassWater, PackageOpen } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "../../../shared/lib/cn";
import BackToHome from "../../../shared/ui/BackToHome";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";

type InventoryCardProps = {
  title: string;
  description: string;
  to?: string;
  icon: typeof Boxes;
  disabled?: boolean;
};

function InventoryCard({ title, description, to, icon, disabled = false }: InventoryCardProps) {
  const content = (
    <Card
      className={cn(
        "h-full rounded-[2rem] p-4 sm:p-5 transition",
        !disabled && "hover:bg-app",
      )}
    >
      <div className="flex h-full items-start gap-3 sm:gap-4">
        <div className="bg-app flex size-11 shrink-0 items-center justify-center rounded-2xl sm:size-12">
          <Icon icon={icon} size="md" decorative />
        </div>
        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="text-lg font-semibold text-balance">{title}</div>
              {disabled ? (
                <span className="rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)] px-2 py-0.5 text-[11px] font-medium text-muted">
                  Скоро будет
                </span>
              ) : null}
            </div>
            <div className="text-pretty text-sm text-muted">{description}</div>
          </div>
        </div>
      </div>
    </Card>
  );

  if (disabled || !to) {
    return <div className="h-full">{content}</div>;
  }

  return (
    <Link to={to} className="block h-full">
      {content}
    </Link>
  );
}

export default function InventoriesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BackToHome />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-balance">Инвентаризации</h2>
        <div className="text-pretty text-sm text-muted">Выбери направление, с которым хочешь работать.</div>
      </div>

      <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
        <InventoryCard
          title="Посуда"
          description="История инвентаризаций, создание новой и сверка потерь по позициям."
          to="/inventories/dishware"
          icon={PackageOpen}
        />
        <InventoryCard
          title="Бар"
          description="Отдельный модуль для барного инвентаря и бокалов."
          icon={GlassWater}
          disabled
        />
        <InventoryCard
          title="Кухня"
          description="Инвентарь кухни."
          icon={ChefHat}
          disabled
        />
      </div>
    </div>
  );
}

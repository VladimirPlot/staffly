import { Boxes, ChefHat, GlassWater, PackageOpen } from "lucide-react";
import { Link } from "react-router-dom";

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
    <Card className="rounded-[2rem] p-5 transition hover:bg-app">
      <div className="flex items-start gap-4">
        <div className="bg-app flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
          <Icon icon={icon} size="md" decorative />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold">{title}</div>
          <div className="mt-1 text-sm text-muted">{description}</div>
          {disabled ? <div className="mt-3 text-xs font-medium text-muted">Скоро будет</div> : null}
        </div>
      </div>
    </Card>
  );

  if (disabled || !to) {
    return <div>{content}</div>;
  }

  return <Link to={to} className="block">{content}</Link>;
}

export default function InventoriesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BackToHome />
      </div>

      <div>
        <h2 className="text-2xl font-semibold">Инвентаризации</h2>
        <div className="text-sm text-muted">Выбери направление, с которым хочешь работать.</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          description="Инвентарь кухни и технологические позиции."
          icon={ChefHat}
          disabled
        />
      </div>
    </div>
  );
}

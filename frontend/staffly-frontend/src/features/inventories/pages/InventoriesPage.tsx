import { Boxes, ChefHat, GlassWater, PackageOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "../../../shared/lib/cn";
import BackToHome from "../../../shared/ui/BackToHome";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import InventoryAccessGuard from "../components/InventoryAccessGuard";
import { type InventorySectionId } from "../api";

type InventoryCardProps = {
  id: InventorySectionId;
  title: string;
  description: string;
  to?: string;
  icon: typeof Boxes;
  disabled?: boolean;
};

const INVENTORY_CARDS: InventoryCardProps[] = [
  {
    id: "dishware",
    title: "Посуда",
    description: "Инвентаризации посуды.",
    to: "/inventories/dishware",
    icon: PackageOpen,
  },
  {
    id: "bar",
    title: "Бар",
    description: "Отдельный модуль для учета барного инвентаря, стекла и бокалов.",
    icon: GlassWater,
    disabled: true,
  },
  {
    id: "kitchen",
    title: "Кухня",
    description: "Отдельный модуль для учета кухонного инвентаря и расходных позиций.",
    icon: ChefHat,
    disabled: true,
  },
];

function InventoryCard({ title, description, to, icon, disabled = false }: InventoryCardProps) {
  const navigate = useNavigate();
  const canOpen = Boolean(to && !disabled);

  return (
    <Card
      role={canOpen ? "link" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      className={cn(
        "group h-full rounded-[2rem] p-4 transition outline-none sm:p-5",
        canOpen && "cursor-pointer hover:bg-app focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]",
      )}
      onClick={() => {
        if (canOpen) navigate(to!);
      }}
      onKeyDown={(event) => {
        if (!canOpen) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(to!);
        }
      }}
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
                  В разработке
                </span>
              ) : null}
            </div>
            <div className="text-pretty text-sm text-muted">{description}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AuthorizedInventoriesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BackToHome />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-balance">Инвентаризации</h2>
        <div className="text-pretty text-sm text-muted">Выбери раздел и открой нужный рабочий поток.</div>
      </div>

      <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
        {INVENTORY_CARDS.map((card) => (
          <InventoryCard key={card.id} {...card} />
        ))}
      </div>
    </div>
  );
}

export default function InventoriesPage() {
  return (
    <InventoryAccessGuard>
      <AuthorizedInventoriesPage />
    </InventoryAccessGuard>
  );
}

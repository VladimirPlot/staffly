import React from "react";
import { MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import BackToHome from "../../../shared/ui/BackToHome";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";

type GameCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const GameCard: React.FC<GameCardProps> = ({ title, description, icon }) => {
  return (
    <Card className="h-full rounded-[2rem] p-4 sm:p-5">
      <div className="flex h-full items-start gap-3 sm:gap-4">
        <div className="bg-app flex size-11 shrink-0 items-center justify-center rounded-2xl sm:size-12">
          <Icon icon={icon} size="md" decorative />
        </div>

        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="text-lg font-semibold text-balance">{title}</div>
              <span className="rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)] px-2 py-0.5 text-[11px] font-medium text-muted">
                В разработке
              </span>
            </div>
            <div className="text-pretty text-sm text-muted">{description}</div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const GamesPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BackToHome />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-balance">Игры</h2>
        <div className="text-pretty text-sm text-muted">
          Небольшие игровые форматы для команды ресторана.
        </div>
      </div>

      <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
        <GameCard
          title="Алиас"
          description="Командная игра на объяснение ресторанных слов, блюд, напитков и ситуаций."
          icon={MessageCircle}
        />
      </div>
    </div>
  );
};

export default GamesPage;

import React from "react";
import { useNavigate } from "react-router-dom";

import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import type { GameCatalogItem } from "../constants/gamesCatalog";

type GameCardProps = {
  game: GameCatalogItem;
};

const GameCard: React.FC<GameCardProps> = ({ game }) => {
  const navigate = useNavigate();

  const handleNavigate = React.useCallback(() => {
    navigate(game.to);
  }, [game.to, navigate]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleNavigate();
      }
    },
    [handleNavigate],
  );

  return (
    <Card
      role="link"
      tabIndex={0}
      className="group h-full cursor-pointer rounded-[2rem] p-4 transition outline-none hover:bg-app focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] sm:p-5"
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
    >
      <div className="flex h-full items-start gap-3 sm:gap-4">
        <div className="bg-app flex size-11 shrink-0 items-center justify-center rounded-2xl sm:size-12">
          <Icon icon={game.icon} size="md" decorative />
        </div>

        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="text-lg font-semibold text-balance">{game.title}</div>
              <span className="rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)] px-2 py-0.5 text-[11px] font-medium text-muted">
                {game.statusLabel}
              </span>
            </div>
            <div className="text-pretty text-sm text-muted">{game.description}</div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default GameCard;

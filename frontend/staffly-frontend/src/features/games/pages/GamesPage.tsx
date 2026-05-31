import React from "react";

import BackToHome from "../../../shared/ui/BackToHome";
import GameCard from "../components/GameCard";
import { GAME_CATALOG } from "../constants/gamesCatalog";

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
        {GAME_CATALOG.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
};

export default GamesPage;

import React from "react";
import { Gauge, Play, Settings2, Shuffle, Timer } from "lucide-react";

import Button from "../../../../shared/ui/Button";
import Icon from "../../../../shared/ui/Icon";
import {
  ALIAS_ROUND_DURATION_SECONDS,
  DIFFICULTY_LABEL_BY_ID,
  DIFFICULTY_OPTIONS,
  WORD_PACK_LABEL_BY_ID,
  WORD_PACK_OPTIONS,
} from "../constants";
import type { DifficultyId, WordPackId } from "../types";
import AliasOptionGroup from "./AliasOptionGroup";

type AliasStartMenuProps = {
  difficulty: DifficultyId;
  wordPack: WordPackId;
  onDifficultyChange: (difficulty: DifficultyId) => void;
  onWordPackChange: (wordPack: WordPackId) => void;
};

const statusBadgeClassName =
  "text-muted inline-flex items-center gap-1.5 rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)]/45 px-3 py-1 text-[11px] font-medium tracking-wide transition-all duration-300 hover:border-[var(--staffly-muted)]/30";

const AliasStartMenu: React.FC<AliasStartMenuProps> = ({
  difficulty,
  wordPack,
  onDifficultyChange,
  onWordPackChange,
}) => {
  const [showSettings, setShowSettings] = React.useState(false);
  const statusBadges = [
    { icon: Timer, label: `${ALIAS_ROUND_DURATION_SECONDS} сек` },
    { icon: Gauge, label: DIFFICULTY_LABEL_BY_ID[difficulty] },
    { icon: Shuffle, label: WORD_PACK_LABEL_BY_ID[wordPack] },
  ];

  return (
    <div className="relative z-10 w-full max-w-xl rounded-3xl border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-6 shadow-sm transition-all duration-300 sm:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-bold tracking-[0.4em] pl-[0.4em] uppercase text-muted leading-none mb-2 select-none">
            staffly
          </span>
          <h1 className="select-none text-4xl font-extrabold tracking-[0.3em] pl-[0.3em] uppercase text-[var(--staffly-text-strong)] sm:text-5xl sm:tracking-[0.4em] sm:pl-[0.4em] transition-all duration-300 leading-none">
            alias
          </h1>
          <div className="mt-3.5 h-[1px] w-32 bg-gradient-to-r from-transparent via-[var(--staffly-border)] to-transparent" />

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {statusBadges.map(({ icon, label }) => (
              <span key={label} className={statusBadgeClassName}>
                <Icon icon={icon} size="xs" decorative />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div
          aria-hidden={!showSettings}
          inert={!showSettings}
          className={[
            "origin-top overflow-hidden transition-all duration-300 ease-in-out",
            showSettings
              ? "max-h-[500px] translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-2 opacity-0",
          ].join(" ")}
        >
          <div className="bg-app space-y-4 rounded-2xl border border-[var(--staffly-border)] p-4 sm:p-5">
            <AliasOptionGroup
              title="Сложность"
              options={DIFFICULTY_OPTIONS}
              value={difficulty}
              columns={3}
              onChange={onDifficultyChange}
            />
            <AliasOptionGroup
              title="Словарь"
              options={WORD_PACK_OPTIONS}
              value={wordPack}
              columns={4}
              onChange={onWordPackChange}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center mt-2">
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-36"
            leftIcon={<Icon icon={Play} size="sm" decorative />}
            disabled
          >
            Играть
          </Button>
          <Button
            type="button"
            variant={showSettings ? "primary" : "outline"}
            size="sm"
            className="w-full sm:w-36"
            leftIcon={<Icon icon={Settings2} size="sm" decorative />}
            onClick={() => setShowSettings((isShown) => !isShown)}
          >
            {showSettings ? "Закрыть" : "Настройки"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AliasStartMenu;

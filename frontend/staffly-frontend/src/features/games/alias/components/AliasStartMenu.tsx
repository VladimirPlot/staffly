import React from "react";
import { Gauge, MessageCircle, Play, Settings2, Shuffle, Timer } from "lucide-react";

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
  "text-muted inline-flex items-center gap-1 rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)] px-2 py-0.5 text-[11px] font-medium";

const AliasStartMenu: React.FC<AliasStartMenuProps> = ({
  difficulty,
  wordPack,
  onDifficultyChange,
  onWordPackChange,
}) => {
  const [showSettings, setShowSettings] = React.useState(false);

  return (
    <div className="relative z-10 w-full max-w-xl rounded-3xl border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-6 shadow-sm transition-all duration-300 sm:p-8">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="bg-app flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--staffly-border)] text-[var(--staffly-text-strong)]">
            <Icon icon={MessageCircle} size="md" decorative />
          </div>
          <div className="min-w-0">
            <div className="text-muted text-[11px] font-semibold tracking-wider uppercase">Alias</div>
            <h3 className="text-xl leading-tight font-bold text-balance text-[var(--staffly-text-strong)] sm:text-2xl">
              Ресторанный раунд
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <span className={statusBadgeClassName}>
                <Icon icon={Timer} size="xs" decorative />
                {ALIAS_ROUND_DURATION_SECONDS} сек
              </span>
              <span className={statusBadgeClassName}>
                <Icon icon={Gauge} size="xs" decorative />
                {DIFFICULTY_LABEL_BY_ID[difficulty]}
              </span>
              <span className={statusBadgeClassName}>
                <Icon icon={Shuffle} size="xs" decorative />
                {WORD_PACK_LABEL_BY_ID[wordPack]}
              </span>
            </div>
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

        <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
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

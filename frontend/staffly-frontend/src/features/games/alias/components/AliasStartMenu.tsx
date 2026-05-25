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

const AliasStartMenu: React.FC<AliasStartMenuProps> = ({
  difficulty,
  wordPack,
  onDifficultyChange,
  onWordPackChange,
}) => {
  return (
    <div className="relative z-10 w-full">
      <div className="rounded-[1rem] border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-3 sm:p-4">
        <div className="flex items-start gap-3 pr-8">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]">
            <Icon icon={MessageCircle} size="sm" decorative />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase text-muted">Alias</div>
            <h3 className="text-xl font-semibold leading-tight text-balance sm:text-2xl">Ресторанный раунд</h3>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Icon icon={Timer} size="xs" decorative /> {ALIAS_ROUND_DURATION_SECONDS} сек
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon icon={Gauge} size="xs" decorative /> {DIFFICULTY_LABEL_BY_ID[difficulty]}
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon icon={Shuffle} size="xs" decorative /> {WORD_PACK_LABEL_BY_ID[wordPack]}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
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

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            size="sm"
            className="w-full sm:flex-1"
            leftIcon={<Icon icon={Play} size="sm" decorative />}
            disabled
          >
            Играть
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:flex-1"
            leftIcon={<Icon icon={Settings2} size="sm" decorative />}
          >
            Настройки
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AliasStartMenu;

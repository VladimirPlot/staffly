import React from "react";
import { Gauge, Minus, Play, Plus, Shuffle, Target, Timer, Trash2 } from "lucide-react";

import Button from "../../../../shared/ui/Button";
import Icon from "../../../../shared/ui/Icon";
import {
  ALIAS_MAX_TEAMS,
  ALIAS_MIN_TEAMS,
  DIFFICULTY_LABEL_BY_ID,
  DIFFICULTY_OPTIONS,
  WORD_PACK_LABEL_BY_ID,
  WORD_PACK_OPTIONS,
} from "../constants";
import type { AliasTeam, DifficultyId, WordPackId } from "../types";
import AliasOptionGroup from "./AliasOptionGroup";

type AliasStartMenuProps = {
  difficulty: DifficultyId;
  wordPack: WordPackId;
  targetScore: number;
  roundDurationSeconds: number;
  teams: AliasTeam[];
  onDifficultyChange: (difficulty: DifficultyId) => void;
  onWordPackChange: (wordPack: WordPackId) => void;
  onTargetScoreChange: (targetScore: number) => void;
  onTeamNameChange: (teamId: string, name: string) => void;
  onTeamAdd: () => void;
  onTeamRemove: (teamId: string) => void;
  onStartGame: () => void;
};

const statusBadgeClassName =
  "text-muted inline-flex items-center gap-1.5 rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)]/45 px-3 py-1 text-[11px] font-medium tracking-wide";

const AliasStartMenu: React.FC<AliasStartMenuProps> = ({
  difficulty,
  wordPack,
  targetScore,
  roundDurationSeconds,
  teams,
  onDifficultyChange,
  onWordPackChange,
  onTargetScoreChange,
  onTeamNameChange,
  onTeamAdd,
  onTeamRemove,
  onStartGame,
}) => {
  const statusBadges = [
    { icon: Timer, label: `${roundDurationSeconds} сек` },
    { icon: Target, label: `${targetScore} очков` },
    { icon: Gauge, label: DIFFICULTY_LABEL_BY_ID[difficulty] },
    { icon: Shuffle, label: WORD_PACK_LABEL_BY_ID[wordPack] },
  ];

  return (
    <div className="relative z-10 flex w-full max-w-3xl flex-col gap-5 rounded-[1.75rem] border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-5 shadow-sm sm:p-7">
      <div className="flex flex-col items-center text-center">
        <span className="mb-2 text-[10px] leading-none font-bold tracking-[0.4em] text-muted uppercase select-none">
          staffly
        </span>
        <h1 className="text-4xl leading-none font-extrabold tracking-[0.3em] text-[var(--staffly-text-strong)] uppercase select-none sm:text-5xl sm:tracking-[0.4em]">
          alias
        </h1>
        <div className="mt-3.5 h-px w-32 bg-gradient-to-r from-transparent via-[var(--staffly-border)] to-transparent" />

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {statusBadges.map(({ icon, label }) => (
            <span key={label} className={statusBadgeClassName}>
              <Icon icon={icon} size="xs" decorative />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <section className="space-y-4 rounded-2xl border border-[var(--staffly-border)] bg-app p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-strong">Команды</div>
              <div className="text-xs text-muted">От 2 до 6 команд, игра до целевого счета.</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={teams.length >= ALIAS_MAX_TEAMS}
              aria-label="Добавить команду"
              onClick={onTeamAdd}
            >
              <Icon icon={Plus} size="sm" />
            </Button>
          </div>

          <div className="space-y-2">
            {teams.map((team, index) => (
              <div key={team.id} className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`alias-team-${team.id}`}>
                  Название команды {index + 1}
                </label>
                <input
                  id={`alias-team-${team.id}`}
                  value={team.name}
                  className="h-10 min-w-0 flex-1 rounded-2xl border border-[var(--staffly-border)] bg-[var(--staffly-surface)] px-3 text-sm text-default shadow-sm outline-none transition focus:ring-2 focus:ring-[var(--staffly-ring)]"
                  maxLength={28}
                  onChange={(event) => onTeamNameChange(team.id, event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted"
                  disabled={teams.length <= ALIAS_MIN_TEAMS}
                  aria-label={`Удалить ${team.name || `команду ${index + 1}`}`}
                  onClick={() => onTeamRemove(team.id)}
                >
                  <Icon icon={Trash2} size="sm" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--staffly-border)] bg-app p-4">
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

          <div className="space-y-2">
            <div className="text-muted text-[11px] font-semibold tracking-wide uppercase">Цель</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Уменьшить цель"
                onClick={() => onTargetScoreChange(targetScore - 5)}
              >
                <Icon icon={Minus} size="sm" />
              </Button>
              <input
                type="number"
                min={5}
                max={60}
                step={5}
                value={targetScore}
                className="h-10 min-w-0 flex-1 rounded-2xl border border-[var(--staffly-border)] bg-[var(--staffly-surface)] px-3 text-center text-sm font-semibold text-default shadow-sm outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]"
                aria-label="Целевой счет"
                onChange={(event) => onTargetScoreChange(Number(event.target.value))}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Увеличить цель"
                onClick={() => onTargetScoreChange(targetScore + 5)}
              >
                <Icon icon={Plus} size="sm" />
              </Button>
            </div>
          </div>
        </section>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full"
        leftIcon={<Icon icon={Play} size="sm" decorative />}
        onClick={onStartGame}
      >
        Начать игру
      </Button>
    </div>
  );
};

export default AliasStartMenu;

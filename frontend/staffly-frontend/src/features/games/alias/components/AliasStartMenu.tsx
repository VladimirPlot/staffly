import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gauge, Minus, Play, Plus, Shuffle, Target, Timer, Trash2 } from "lucide-react";

import Button from "../../../../shared/ui/Button";
import Icon from "../../../../shared/ui/Icon";
import {
  ALIAS_MAX_TARGET_SCORE,
  ALIAS_MAX_TEAMS,
  ALIAS_MIN_TARGET_SCORE,
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
  "text-muted inline-flex items-center gap-1.5 rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)]/45 px-3 py-1 text-[11px] font-medium tracking-wide select-none";
const startButtonClassName =
  "flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--staffly-text-strong)] text-sm font-bold text-[var(--staffly-surface)] shadow-md transition-all hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]";
const MotionButton = motion(Button);

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
    { id: "timer", icon: Timer, label: `${roundDurationSeconds} сек` },
    { id: "target", icon: Target, label: `${targetScore} очков` },
    { id: "difficulty", icon: Gauge, label: DIFFICULTY_LABEL_BY_ID[difficulty] },
    { id: "wordPack", icon: Shuffle, label: WORD_PACK_LABEL_BY_ID[wordPack] },
  ];
  const targetScoreActions = [
    { icon: Minus, label: "Уменьшить цель", disabled: targetScore <= ALIAS_MIN_TARGET_SCORE, value: targetScore - 5 },
    { icon: Plus, label: "Увеличить цель", disabled: targetScore >= ALIAS_MAX_TARGET_SCORE, value: targetScore + 5 },
  ] as const;
  const renderTargetScoreButton = ({ icon, label, disabled, value }: (typeof targetScoreActions)[number]) => (
    <MotionButton
      key={label}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      type="button"
      variant="outline"
      size="icon"
      className="h-8 w-8 rounded-lg bg-[var(--staffly-surface)]"
      disabled={disabled}
      aria-label={label}
      onClick={() => onTargetScoreChange(value)}
    >
      <Icon icon={icon} size="xs" className="h-3.5 w-3.5" decorative />
    </MotionButton>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 25 }}
      className="relative z-10 flex w-full max-w-3xl flex-col gap-6 rounded-[2rem] border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-5 sm:p-8"
    >
      <div className="flex flex-col items-center text-center">
        <span className="text-muted mb-2 text-[10px] leading-none font-bold tracking-[0.4em] uppercase select-none">
          staffly
        </span>
        <h1 className="text-4xl leading-none font-extrabold tracking-[0.3em] text-[var(--staffly-text-strong)] uppercase select-none sm:text-5xl sm:tracking-[0.4em]">
          alias
        </h1>
        <div className="mt-3.5 h-px w-32 bg-gradient-to-r from-transparent via-[var(--staffly-border)] to-transparent" />

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {statusBadges.map(({ id, icon, label }) => (
            <motion.span
              layout
              key={id}
              className={statusBadgeClassName}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
            >
              <Icon icon={icon} size="xs" className="h-3 w-3" decorative />
              <span className="whitespace-nowrap">{label}</span>
            </motion.span>
          ))}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 md:divide-x md:divide-[var(--staffly-border)]/30">
        <div className="space-y-4 pr-0 md:pr-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-strong text-sm font-bold tracking-tight">Команды</h2>
              <p className="text-muted mt-0.5 text-xs">Добавьте от 2 до 6 команд</p>
            </div>
            {teams.length < ALIAS_MAX_TEAMS && (
              <MotionButton
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onTeamAdd}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-xl bg-[var(--staffly-surface)] px-3 text-xs font-bold text-[var(--staffly-text-strong)]"
                leftIcon={<Icon icon={Plus} size="xs" className="h-3.5 w-3.5" decorative />}
              >
                Добавить
              </MotionButton>
            )}
          </div>

          <div className="relative space-y-2.5 overflow-hidden">
            <AnimatePresence initial={false}>
              {teams.map((team, index) => (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95, height: 0, marginBottom: 0, overflow: "hidden" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="flex items-center gap-2"
                >
                  <div className="relative flex flex-1 items-center">
                    <label className="sr-only" htmlFor={`alias-team-${team.id}`}>
                      Название команды {index + 1}
                    </label>
                    <input
                      id={`alias-team-${team.id}`}
                      value={team.name}
                      className="text-strong h-10 w-full rounded-xl border border-[var(--staffly-border)] bg-[var(--staffly-surface)] px-4 pr-10 text-sm font-medium transition-all outline-none hover:border-[var(--staffly-muted)]/50 focus:border-[var(--staffly-text-strong)] focus:ring-2 focus:ring-[var(--staffly-ring)]"
                      maxLength={28}
                      placeholder={`Команда ${index + 1}`}
                      onChange={(event) => onTeamNameChange(team.id, event.target.value)}
                    />
                    <span className="text-muted pointer-events-none absolute right-4 text-xs font-semibold select-none">
                      #{index + 1}
                    </span>
                  </div>

                  {teams.length > ALIAS_MIN_TEAMS && (
                    <MotionButton
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      variant="outline"
                      size="icon"
                      className="text-muted h-10 w-10 shrink-0 rounded-xl bg-[var(--staffly-surface)] hover:border-red-200 hover:bg-red-50/50 hover:text-red-500 dark:hover:border-red-900/30 dark:hover:bg-red-950/20"
                      aria-label={`Удалить ${team.name || `команду ${index + 1}`}`}
                      onClick={() => onTeamRemove(team.id)}
                    >
                      <Icon icon={Trash2} size="xs" decorative />
                    </MotionButton>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-5 pl-0 md:pl-8">
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
            <div className="text-muted pl-1 text-[10px] font-bold tracking-wider uppercase select-none">
              Целевой счет
            </div>
            <div className="relative flex items-center justify-between rounded-xl border border-[var(--staffly-border)]/40 bg-[var(--staffly-border)]/50 p-1">
              {renderTargetScoreButton(targetScoreActions[0])}

              <div className="flex-1 text-center text-sm font-bold text-[var(--staffly-text-strong)] select-none">
                {targetScore} <span className="text-muted text-xs font-semibold">очков</span>
              </div>

              {renderTargetScoreButton(targetScoreActions[1])}
            </div>
          </div>
        </div>
      </div>

      <MotionButton
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onStartGame}
        type="button"
        size="lg"
        className={startButtonClassName}
        leftIcon={<Icon icon={Play} size="xs" className="h-4 w-4 fill-current" decorative />}
      >
        Начать игру
      </MotionButton>
    </motion.div>
  );
};

export default AliasStartMenu;

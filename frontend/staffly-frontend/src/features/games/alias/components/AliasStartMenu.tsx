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
  isCompactLandscape?: boolean;
  onDifficultyChange: (difficulty: DifficultyId) => void;
  onWordPackChange: (wordPack: WordPackId) => void;
  onTargetScoreChange: (targetScore: number) => void;
  onTeamNameChange: (teamId: string, name: string) => void;
  onTeamAdd: () => void;
  onTeamRemove: (teamId: string) => void;
  onStartGame: () => void;
};

const statusBadgeClassName =
  "alias-status-badge text-muted inline-flex items-center gap-1.5 rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)]/45 px-3 py-1 text-[11px] font-medium tracking-wide select-none";
const startButtonClassName =
  "alias-start-button flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--staffly-text-strong)] text-sm font-bold text-[var(--staffly-surface)] shadow-md transition-all hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]";
const MotionButton = motion(Button);

const AliasStartMenu: React.FC<AliasStartMenuProps> = ({
  difficulty,
  wordPack,
  targetScore,
  roundDurationSeconds,
  teams,
  isCompactLandscape = false,
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
      className={[
        "rounded-lg bg-[var(--staffly-surface)]",
        isCompactLandscape ? "h-8 min-h-[2rem] w-8" : "h-8 w-8",
      ].join(" ")}
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
      className={[
        "alias-start-menu relative z-10 w-full border border-[var(--staffly-border)] bg-[var(--staffly-surface)]",
        isCompactLandscape
          ? "grid h-full w-full max-w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-[0.65rem] overflow-hidden rounded-none border-none p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(3.5rem,env(safe-area-inset-right))] pb-[max(0.6rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]"
          : "flex max-w-3xl flex-col gap-6 rounded-[2rem] p-5 sm:p-8",
      ].join(" ")}
    >
      <div
        className={[
          "alias-start-header",
          isCompactLandscape
            ? "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 text-left"
            : "flex flex-col items-center text-center",
        ].join(" ")}
      >
        <span
          className={[
            "alias-start-brand text-muted mb-2 text-[10px] leading-none font-bold tracking-[0.4em] uppercase select-none",
            isCompactLandscape ? "hidden" : "",
          ].join(" ")}
        >
          staffly
        </span>
        <h1
          className={[
            "alias-start-title leading-none font-extrabold text-[var(--staffly-text-strong)] uppercase select-none",
            isCompactLandscape
              ? "text-[1.3rem] tracking-[0.25em]"
              : "text-4xl tracking-[0.3em] sm:text-5xl sm:tracking-[0.4em]",
          ].join(" ")}
        >
          alias
        </h1>
        <div
          className={[
            "alias-start-divider mt-3.5 h-px w-32 bg-gradient-to-r from-transparent via-[var(--staffly-border)] to-transparent",
            isCompactLandscape ? "hidden" : "",
          ].join(" ")}
        />

        <div
          className={[
            "alias-status-badges flex flex-wrap",
            isCompactLandscape ? "mt-0 justify-end gap-1.5 pr-10" : "mt-4 justify-center gap-2",
          ].join(" ")}
        >
          {statusBadges.map(({ id, icon, label }) => (
            <motion.span
              layout
              key={id}
              className={[statusBadgeClassName, isCompactLandscape ? "px-2 py-0.5 text-[0.64rem]" : ""].join(" ")}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
            >
              <Icon icon={icon} size="xs" className="h-3 w-3" decorative />
              <span className="whitespace-nowrap">{label}</span>
            </motion.span>
          ))}
        </div>
      </div>

      <div
        className={[
          "alias-start-grid grid md:divide-x md:divide-[var(--staffly-border)]/30",
          isCompactLandscape
            ? "min-h-0 grid-cols-[minmax(14rem,0.9fr)_minmax(21rem,1.1fr)] gap-[0.9rem] overflow-y-auto overscroll-contain"
            : "gap-8 md:grid-cols-2",
        ].join(" ")}
        style={isCompactLandscape ? { WebkitOverflowScrolling: "touch" } : undefined}
      >
        <div
          className={[
            "alias-teams-panel pr-0",
            isCompactLandscape ? "space-y-[0.55rem] pr-[0.9rem] md:pr-[0.9rem]" : "space-y-4 md:pr-8",
          ].join(" ")}
        >
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
                className={[
                  "alias-team-add rounded-xl bg-[var(--staffly-surface)] px-3 text-xs font-bold text-[var(--staffly-text-strong)]",
                  isCompactLandscape ? "h-8 min-h-[2rem]" : "h-8",
                ].join(" ")}
                leftIcon={<Icon icon={Plus} size="xs" className="h-3.5 w-3.5" decorative />}
              >
                Добавить
              </MotionButton>
            )}
          </div>

          <div
            className={[
              "alias-team-list relative space-y-2.5",
              isCompactLandscape ? "max-h-32 overflow-y-auto pr-0.5" : "overflow-hidden",
            ].join(" ")}
          >
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
                      className={[
                        "alias-team-input text-strong w-full rounded-xl border border-[var(--staffly-border)] bg-[var(--staffly-surface)] px-4 pr-10 text-sm font-medium transition-all outline-none hover:border-[var(--staffly-muted)]/50 focus:border-[var(--staffly-text-strong)] focus:ring-2 focus:ring-[var(--staffly-ring)]",
                        isCompactLandscape ? "h-8.5 min-h-[2.125rem]" : "h-10",
                      ].join(" ")}
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
                      className={[
                        "alias-team-remove text-muted shrink-0 rounded-xl bg-[var(--staffly-surface)] hover:border-red-200 hover:bg-red-50/50 hover:text-red-500 dark:hover:border-red-900/30 dark:hover:bg-red-950/20",
                        isCompactLandscape ? "h-8.5 min-h-[2.125rem] w-8.5" : "h-10 w-10",
                      ].join(" ")}
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

        <div
          className={[
            "alias-settings-panel pl-0",
            isCompactLandscape
              ? "flex min-h-0 flex-col gap-2 overflow-visible pb-1 pl-[0.9rem] md:pl-[0.9rem]"
              : "space-y-5 md:pl-8",
          ].join(" ")}
        >
          <AliasOptionGroup
            title="Сложность"
            options={DIFFICULTY_OPTIONS}
            value={difficulty}
            columns={3}
            isCompactLandscape={isCompactLandscape}
            onChange={onDifficultyChange}
          />
          <AliasOptionGroup
            title="Словарь"
            options={WORD_PACK_OPTIONS}
            value={wordPack}
            columns={4}
            isCompactLandscape={isCompactLandscape}
            onChange={onWordPackChange}
          />

          <div
            className={[
              "alias-target-score",
              isCompactLandscape ? "min-h-0 shrink-0 space-y-[0.35rem]" : "space-y-2",
            ].join(" ")}
          >
            <div
              className={[
                "text-muted pl-1 text-[10px] font-bold tracking-wider uppercase select-none",
                isCompactLandscape ? "leading-none" : "",
              ].join(" ")}
            >
              Целевой счет
            </div>
            <div
              className={[
                "relative flex items-center justify-between rounded-xl border border-[var(--staffly-border)]/40 bg-[var(--staffly-border)]/50 p-1",
                isCompactLandscape ? "min-h-11" : "",
              ].join(" ")}
            >
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
        className={[startButtonClassName, isCompactLandscape ? "relative z-[1] h-9.5 min-h-[2.375rem]" : ""].join(" ")}
        leftIcon={<Icon icon={Play} size="xs" className="h-4 w-4 fill-current" decorative />}
      >
        Начать игру
      </MotionButton>
    </motion.div>
  );
};

export default AliasStartMenu;

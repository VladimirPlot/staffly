import React from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Flag,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Smartphone,
  Trophy,
  X,
} from "lucide-react";

import Button from "../../../../shared/ui/Button";
import Icon from "../../../../shared/ui/Icon";
import { useAliasControls } from "../hooks/useAliasControls";
import { useAliasDeviceMode } from "../hooks/useAliasDeviceMode";
import { getAliasRoundScore, useAliasGame } from "../hooks/useAliasGame";
import { useAliasMotionControls } from "../hooks/useAliasMotionControls";
import type { AliasRoundEvent, AliasRoundResult, AliasTeam } from "../types";

type AliasGameViewProps = ReturnType<typeof useAliasGame>;

const getResultClassName = (result: AliasRoundEvent["result"]) =>
  result === "correct"
    ? "border-[var(--staffly-gain-border)] bg-[var(--staffly-gain-bg)] text-[var(--staffly-gain-text)]"
    : result === "skipped"
      ? "border-[var(--staffly-loss-border)] bg-[var(--staffly-loss-bg)] text-[var(--staffly-loss-text)]"
      : "border-[var(--staffly-border)] bg-app text-muted";

const getMotionStatusLabel = (status: ReturnType<typeof useAliasMotionControls>["status"]) => {
  if (status === "active") return "Наклоны: вкл";
  if (status === "denied") return "Нет доступа к наклонам";
  if (status === "unsupported") return "Наклоны недоступны";
  return "Наклоны: выкл";
};

const MotionSection = motion.section;
const MotionDiv = motion.div;
const MotionButton = motion.button;

const Scoreboard: React.FC<{ teams: AliasTeam[]; activeTeamId: string | null; targetScore: number }> = ({
  teams,
  activeTeamId,
  targetScore,
}) => (
  <div className="flex w-full flex-wrap justify-center gap-2">
    {teams.map((team) => {
      const isActive = team.id === activeTeamId;

      return (
        <div
          key={team.id}
          className={[
            "w-full min-w-0 rounded-2xl border p-3 transition sm:w-[min(20rem,calc(50%-0.25rem))] lg:w-80",
            isActive
              ? "border-[var(--staffly-text-strong)] bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
              : "border-[var(--staffly-border)] bg-[var(--staffly-control)] text-default",
          ].join(" ")}
        >
          <div className="truncate text-xs font-medium opacity-75">{team.name}</div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="text-2xl leading-none font-bold">{team.score}</span>
            <span className="text-[11px] opacity-70">из {targetScore}</span>
          </div>
        </div>
      );
    })}
  </div>
);

const getReviewButtonClassName = (isActive: boolean, result: AliasRoundResult) =>
  [
    "inline-flex h-8 w-8 items-center justify-center rounded-xl border transition",
    isActive
      ? getResultClassName(result)
      : "border-[var(--staffly-border)] bg-[var(--staffly-surface)] text-muted hover:text-strong",
  ].join(" ");

const RoundEventsList: React.FC<{
  events: AliasRoundEvent[];
  onReview: (eventIndex: number, result: AliasRoundResult) => void;
}> = ({ events, onReview }) => {
  if (events.length === 0) {
    return <div className="rounded-2xl border border-[var(--staffly-border)] bg-app p-4 text-sm text-muted">Пока нет ответов.</div>;
  }

  return (
    <MotionDiv
      className="grid max-h-[min(58vh,34rem)] min-h-[18rem] gap-2 overflow-auto pr-1 sm:grid-cols-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {events.map((event, index) => {
        const isCorrect = event.result === "correct";
        const isSkipped = event.result === "skipped";

        return (
          <MotionDiv
            key={`${event.word.id}-${index}`}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: Math.min(index * 0.018, 0.16), ease: "easeOut" }}
            className={[
              "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-2 text-sm transition-colors duration-150",
              getResultClassName(event.result),
            ].join(" ")}
          >
            <span className="min-w-0 truncate font-medium">{event.word.text}</span>
            <div className="flex shrink-0 items-center gap-1" aria-label={`Проверка слова ${event.word.text}`}>
              <MotionButton
                type="button"
                className={getReviewButtonClassName(isCorrect, "correct")}
                aria-pressed={isCorrect}
                aria-label="Отметить верным"
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
                onClick={() => onReview(index, "correct")}
              >
                <Icon icon={Check} size="xs" decorative />
              </MotionButton>
              <MotionButton
                type="button"
                className={getReviewButtonClassName(isSkipped, "skipped")}
                aria-pressed={isSkipped}
                aria-label="Отметить неверным"
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
                onClick={() => onReview(index, "skipped")}
              >
                <Icon icon={X} size="xs" decorative />
              </MotionButton>
            </div>
          </MotionDiv>
        );
      })}
    </MotionDiv>
  );
};

const AliasGameView: React.FC<AliasGameViewProps> = ({ state, actions }) => {
  const [exitConfirmationOpen, setExitConfirmationOpen] = React.useState(false);
  const { isTouchDevice } = useAliasDeviceMode();
  const currentTeam = state.teams[state.currentTeamIndex] ?? null;
  const activeTeamId = currentTeam?.id ?? null;
  const roundScore = getAliasRoundScore(state.roundEvents);
  const lastRoundScore = getAliasRoundScore(state.lastRoundEvents);
  const motionControls = useAliasMotionControls({
    enabled: state.phase === "playing",
    onCorrect: actions.markCorrect,
    onSkip: actions.markSkipped,
  });

  React.useEffect(() => {
    if (!isTouchDevice && motionControls.status === "active") {
      motionControls.disableMotionControls();
    }
  }, [isTouchDevice, motionControls]);

  const handlePauseToggle = React.useCallback(() => {
    if (state.phase === "paused") {
      actions.resumeRound();
      return;
    }

    actions.pauseRound();
  }, [actions, state.phase]);

  const handleStartRound = React.useCallback(() => {
    motionControls.resetMotionBaseline();
    actions.startRound();
  }, [actions, motionControls]);

  const { cardHandlers } = useAliasControls({
    enabled: !exitConfirmationOpen && (state.phase === "playing" || state.phase === "paused"),
    onCorrect: actions.markCorrect,
    onSkip: actions.markSkipped,
    onPauseToggle: handlePauseToggle,
    onExitRequest: () => setExitConfirmationOpen(true),
  });

  if (!currentTeam && state.phase !== "gameOver") {
    return null;
  }

  const contentWidthClassName = state.phase === "roundSummary" ? "max-w-6xl" : "max-w-5xl";

  return (
    <div
      className={["relative z-10 flex w-full flex-col gap-4 transition-[max-width] duration-200", contentWidthClassName].join(
        " ",
      )}
    >
      <Scoreboard teams={state.teams} activeTeamId={activeTeamId} targetScore={state.settings.targetScore} />

      {state.phase === "ready" && currentTeam ? (
        <section className="flex min-h-[360px] flex-col items-center justify-center rounded-[1.75rem] border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-6 text-center shadow-sm">
          <div className="text-sm font-medium text-muted">Ход команды</div>
          <h2 className="mt-2 max-w-full truncate text-4xl font-bold text-strong sm:text-5xl">{currentTeam.name}</h2>
          <div className="mt-3 text-sm text-muted">
            {state.settings.roundDurationSeconds} секунд, верно +1, пропуск -1
          </div>
          <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full"
              leftIcon={<Icon icon={Play} size="sm" decorative />}
              onClick={handleStartRound}
            >
              Старт раунда
            </Button>
            {isTouchDevice ? (
              <Button
                type="button"
                variant={motionControls.status === "active" ? "primary" : "outline"}
                size="sm"
                className="w-full"
                leftIcon={<Icon icon={Smartphone} size="sm" decorative />}
                disabled={motionControls.status === "denied" || motionControls.status === "unsupported"}
                onClick={() => {
                  if (motionControls.status === "active") {
                    motionControls.disableMotionControls();
                    return;
                  }

                  void motionControls.requestMotionPermission();
                }}
              >
                {getMotionStatusLabel(motionControls.status)}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {(state.phase === "playing" || state.phase === "paused") && currentTeam ? (
        <section className="relative overflow-hidden rounded-[1.75rem] border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-muted">Объясняет</div>
              <div className="text-lg font-semibold text-strong">{currentTeam.name}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-2xl border border-[var(--staffly-border)] bg-app px-4 py-2 text-center">
                <div className="text-[10px] font-semibold tracking-wide text-muted uppercase">Время</div>
                <div className="text-2xl leading-none font-bold text-strong">{state.remainingSeconds}</div>
              </div>
              <div className="rounded-2xl border border-[var(--staffly-border)] bg-app px-4 py-2 text-center">
                <div className="text-[10px] font-semibold tracking-wide text-muted uppercase">Раунд</div>
                <div className="text-2xl leading-none font-bold text-strong">{roundScore}</div>
              </div>
            </div>
          </div>

          <div
            {...cardHandlers}
            className={[
              "flex min-h-[280px] cursor-grab touch-none select-none flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-[var(--staffly-divider)] bg-app p-6 text-center outline-none active:cursor-grabbing sm:min-h-[340px]",
              state.phase === "paused" ? "opacity-45" : "",
            ].join(" ")}
            tabIndex={0}
            aria-label="Карточка слова. Свайп вниз означает верно, свайп вверх означает пропуск."
          >
            <div className="mb-5 flex gap-3 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1">
                <Icon icon={ArrowDown} size="xs" decorative />
                верно
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon icon={ArrowUp} size="xs" decorative />
                пропуск
              </span>
            </div>
            <div className="max-w-full text-5xl leading-tight font-black text-strong text-balance sm:text-7xl">
              {state.currentWord?.text}
            </div>
          </div>

          {state.phase === "paused" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--staffly-surface)]/75 p-5 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[1.5rem] border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-5 text-center shadow-[var(--staffly-shadow)]">
                <div className="text-xl font-semibold text-strong">Пауза</div>
                <div className="mt-2 text-sm text-muted">Раунд остановлен, счет не изменится до продолжения.</div>
                <div className="mt-4 flex gap-2">
                  <Button type="button" className="flex-1" onClick={actions.resumeRound}>
                    Продолжить
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setExitConfirmationOpen(true)}>
                    Завершить
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              size="lg"
              leftIcon={<Icon icon={Check} size="sm" decorative />}
              onClick={actions.markCorrect}
            >
              Верно
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              leftIcon={<Icon icon={SkipForward} size="sm" decorative />}
              onClick={actions.markSkipped}
            >
              Пропуск
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              leftIcon={<Icon icon={state.phase === "paused" ? Play : Pause} size="sm" decorative />}
              onClick={handlePauseToggle}
            >
              {state.phase === "paused" ? "Дальше" : "Пауза"}
            </Button>
          </div>
        </section>
      ) : null}

      {state.phase === "roundSummary" && state.lastRoundTeam ? (
        <MotionSection
          className="rounded-[1.75rem] border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-5 shadow-sm sm:p-6"
          initial={{ opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-medium text-muted">Итог раунда</div>
              <h2 className="text-3xl font-bold text-strong">{state.lastRoundTeam.name}</h2>
            </div>
            <div className="rounded-2xl border border-[var(--staffly-border)] bg-app px-4 py-3 text-center">
              <div className="text-[10px] font-semibold tracking-wide text-muted uppercase">Очки</div>
              <MotionDiv
                key={lastRoundScore}
                className="text-3xl leading-none font-bold text-strong"
                initial={{ scale: 0.94 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
              >
                {lastRoundScore > 0 ? `+${lastRoundScore}` : lastRoundScore}
              </MotionDiv>
            </div>
          </div>
          <div className="mt-5">
            <RoundEventsList events={state.lastRoundEvents} onReview={actions.reviewLastRoundEvent} />
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="flex-1"
              leftIcon={<Icon icon={state.winnerTeam ? Trophy : Flag} size="sm" decorative />}
              onClick={state.winnerTeam ? actions.completeGame : actions.nextTurn}
            >
              {state.winnerTeam ? "Завершить игру" : "Следующая команда"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              leftIcon={<Icon icon={RotateCcw} size="sm" decorative />}
              onClick={actions.resetGame}
            >
              Новая игра
            </Button>
          </div>
        </MotionSection>
      ) : null}

      {state.phase === "gameOver" && state.winnerTeam ? (
        <section className="flex min-h-[360px] flex-col items-center justify-center rounded-[1.75rem] border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-6 text-center shadow-sm">
          <Icon icon={Trophy} size="lg" className="text-[var(--staffly-gain-text)]" />
          <div className="mt-4 text-sm font-medium text-muted">Победитель</div>
          <h2 className="mt-1 max-w-full truncate text-4xl font-black text-strong sm:text-6xl">{state.winnerTeam.name}</h2>
          <div className="mt-3 text-sm text-muted">Финальный счет: {state.winnerTeam.score}</div>
          <Button
            type="button"
            className="mt-6 w-full max-w-xs"
            leftIcon={<Icon icon={RotateCcw} size="sm" decorative />}
            onClick={actions.resetGame}
          >
            Сыграть еще
          </Button>
        </section>
      ) : null}

      {exitConfirmationOpen ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[1.75rem] bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[1.5rem] border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-5 shadow-[var(--staffly-shadow)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-strong">Завершить раунд?</div>
                <div className="mt-1 text-sm text-muted">Текущие ответы будут засчитаны как итог этого хода.</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Закрыть подтверждение"
                onClick={() => setExitConfirmationOpen(false)}
              >
                <Icon icon={X} size="sm" />
              </Button>
            </div>
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  setExitConfirmationOpen(false);
                  actions.finishRound();
                }}
              >
                Завершить
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setExitConfirmationOpen(false)}>
                Назад
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AliasGameView;

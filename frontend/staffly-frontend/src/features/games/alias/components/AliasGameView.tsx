import React from "react";
import { AnimatePresence, motion, type PanInfo, useMotionValue, useTransform } from "framer-motion";
import { ArrowDown, ArrowUp, Check, Flag, Pause, Play, RotateCcw, SkipForward, Trophy, X } from "lucide-react";

import Button from "../../../../shared/ui/Button";
import Icon from "../../../../shared/ui/Icon";
import { useAliasControls } from "../hooks/useAliasControls";
import { getAliasRoundScore, useAliasGame } from "../hooks/useAliasGame";
import type { AliasRoundEvent, AliasRoundResult, AliasTeam } from "../types";

type AliasGameViewProps = ReturnType<typeof useAliasGame>;
type AliasGameViewComponentProps = AliasGameViewProps & {
  isCompactLandscape?: boolean;
};

const getResultClassName = (result: AliasRoundEvent["result"]) =>
  result === "correct"
    ? "border-[var(--staffly-gain-border)] bg-[var(--staffly-gain-bg)] text-[var(--staffly-gain-text)]"
    : result === "skipped"
      ? "border-[var(--staffly-loss-border)] bg-[var(--staffly-loss-bg)] text-[var(--staffly-loss-text)]"
      : "border-[var(--staffly-border)] bg-app text-muted";

const MotionSection = motion.section;
const MotionDiv = motion.div;

type ExitDirection = "up" | "down" | null;

const Scoreboard: React.FC<{
  teams: AliasTeam[];
  activeTeamId: string | null;
  targetScore: number;
  isCompactLandscape?: boolean;
}> = ({ teams, activeTeamId, targetScore, isCompactLandscape = false }) => (
  <div
    className={[
      "alias-scoreboard flex w-full justify-center",
      isCompactLandscape ? "flex-nowrap gap-1.5 overflow-x-auto pb-[0.05rem]" : "flex-wrap gap-2",
    ].join(" ")}
  >
    {teams.map((team) => {
      const isActive = team.id === activeTeamId;

      return (
        <div
          key={team.id}
          className={[
            "alias-score-card min-w-0 rounded-xl border transition-all duration-200",
            isCompactLandscape
              ? "w-[min(11rem,calc(50%-0.2rem))] rounded-[0.6rem] px-2 py-1"
              : "w-full p-3.5 sm:w-[min(20rem,calc(50%-0.2rem))] lg:w-80",
            isActive
              ? "border-[var(--staffly-text-strong)] bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)] shadow-md"
              : "text-default border-[var(--staffly-border)] bg-[var(--staffly-surface)] shadow-xs",
          ].join(" ")}
        >
          <div className="truncate text-xs font-semibold opacity-80">{team.name}</div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className={[isCompactLandscape ? "text-[0.95rem]" : "text-2xl", "leading-none font-bold"].join(" ")}>
              {team.score}
            </span>
            <span className="text-[11px] opacity-60">из {targetScore}</span>
          </div>
        </div>
      );
    })}
  </div>
);

const getReviewButtonClassName = (isActive: boolean, result: AliasRoundResult) =>
  [
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] cursor-pointer",
    isActive
      ? getResultClassName(result)
      : "border-[var(--staffly-border)] bg-[var(--staffly-surface)] text-muted hover:text-strong",
  ].join(" ");

const RoundEventsList: React.FC<{
  events: AliasRoundEvent[];
  onReview: (eventIndex: number, result: AliasRoundResult) => void;
  isCompactLandscape?: boolean;
}> = ({ events, onReview, isCompactLandscape = false }) => {
  if (events.length === 0) {
    return (
      <div className="bg-app text-muted rounded-xl border border-[var(--staffly-border)] p-4 text-sm">
        Пока нет ответов.
      </div>
    );
  }

  return (
    <MotionDiv
      className={[
        "alias-round-events grid grid-cols-1 gap-2 overflow-y-auto pr-1",
        isCompactLandscape ? "h-full max-h-full" : "max-h-[min(50vh,30rem)] sm:grid-cols-2",
      ].join(" ")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {events.map((event, index) => {
        const isCorrect = event.result === "correct";
        const isSkipped = event.result === "skipped";
        const reviewActions = [
          { result: "correct", active: isCorrect, label: "Отметить верным", icon: Check },
          { result: "skipped", active: isSkipped, label: "Отметить неверным", icon: X },
        ] as const;

        return (
          <MotionDiv
            key={`${event.word.id}-${index}`}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: Math.min(index * 0.018, 0.16), ease: "easeOut" }}
            className={[
              "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3.5 py-2 text-sm shadow-xs transition-all duration-150",
              getResultClassName(event.result),
            ].join(" ")}
          >
            <span
              className={[
                "min-w-0 font-semibold",
                isCompactLandscape ? "[overflow-wrap:anywhere] whitespace-normal" : "truncate",
              ].join(" ")}
            >
              {event.word.text}
            </span>
            <div className="flex shrink-0 items-center gap-1" aria-label={`Проверка слова ${event.word.text}`}>
              {reviewActions.map(({ result, active, label, icon }) => (
                <motion.button
                  key={result}
                  type="button"
                  className={getReviewButtonClassName(active, result)}
                  aria-pressed={active}
                  aria-label={label}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                  onClick={() => onReview(index, result)}
                >
                  <Icon icon={icon} size="xs" decorative />
                </motion.button>
              ))}
            </div>
          </MotionDiv>
        );
      })}
    </MotionDiv>
  );
};

const PausedRoundCard: React.FC<{
  onResume: () => void;
  onExit: () => void;
}> = ({ onResume, onExit }) => (
  <motion.div
    key="paused-overlay"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.2 }}
    className="alias-paused-card bg-app absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[1.5rem] border border-[var(--staffly-border)] p-6 text-center select-none"
  >
    <div className="pointer-events-none absolute -inset-10 animate-[pulse_3s_infinite] bg-radial-[circle_at_center,var(--staffly-text-strong)/0.03,transparent_60%]" />
    <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--staffly-border)] bg-[var(--staffly-control)] shadow-xs">
      <div className="absolute inset-0 animate-ping rounded-full bg-[var(--staffly-text-strong)]/5 opacity-75" />
      <Pause className="text-strong h-6 w-6 stroke-[2.5]" />
    </div>

    <div className="text-muted text-xs font-bold tracking-wider uppercase">раунд остановлен</div>
    <div className="text-strong mt-2 text-2xl leading-tight font-extrabold sm:text-3xl">Время на паузе</div>
    <p className="text-muted mt-2 max-w-[280px] text-xs sm:text-sm">Счет не изменится, пока вы не возобновите игру.</p>

    <div className="z-30 mt-6 flex w-full max-w-xs gap-2">
      <Button
        type="button"
        className="flex-1 cursor-pointer"
        leftIcon={<Icon icon={Play} size="xs" decorative />}
        onClick={onResume}
      >
        Продолжить
      </Button>
      <Button
        type="button"
        variant="outline"
        className="flex-1 cursor-pointer"
        leftIcon={<Icon icon={X} size="xs" decorative />}
        onClick={onExit}
      >
        Завершить
      </Button>
    </div>
  </motion.div>
);

const WordCard: React.FC<{
  word: AliasRoundEvent["word"] | null;
  exitDirection: ExitDirection;
  isCompactLandscape?: boolean;
  onCorrect: () => void;
  onSkip: () => void;
}> = ({ word, exitDirection, isCompactLandscape = false, onCorrect, onSkip }) => {
  const threshold = isCompactLandscape ? 60 : 80;
  const y = useMotionValue(0);
  const rotate = useTransform(y, [-threshold * 1.5, threshold * 1.5], [-4, 4]);
  const opacity = useTransform(
    y,
    [-threshold * 2.5, -threshold * 1.5, 0, threshold * 1.5, threshold * 2.5],
    [0, 1, 1, 1, 0],
  );
  const correctOverlayOpacity = useTransform(y, [0, threshold], [0, 1]);
  const skipOverlayOpacity = useTransform(y, [-threshold, 0], [1, 0]);
  const correctScale = useTransform(y, [0, threshold], [0.8, 1]);
  const skipScale = useTransform(y, [-threshold, 0], [1, 0.8]);

  React.useEffect(() => {
    y.set(0);
  }, [word?.id, y]);

  const handleDragEnd = React.useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > threshold) onCorrect();
      else if (info.offset.y < -threshold) onSkip();
    },
    [onCorrect, onSkip, threshold],
  );

  return (
    <motion.div
      key={word?.id}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.8}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{ y, rotate, opacity }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.96,
        y: exitDirection === "down" ? threshold * 2.5 : exitDirection === "up" ? -threshold * 2.5 : 0,
        transition: { duration: 0.18, ease: "easeIn" },
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={[
        "alias-word-card bg-app absolute inset-0 flex cursor-grab touch-none flex-col items-center justify-center border-2 border-dashed border-[var(--staffly-divider)] text-center transition-colors outline-none select-none active:cursor-grabbing",
        isCompactLandscape ? "rounded-[1.1rem] p-[0.85rem]" : "rounded-[1.5rem] p-6",
      ].join(" ")}
      tabIndex={0}
      aria-label="Карточка слова. Свайп вниз означает верно, свайп вверх означает пропуск."
    >
      <motion.div
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[1.5rem] border-2 border-emerald-500/80 bg-emerald-500/[0.08]"
        style={{ opacity: correctOverlayOpacity }}
      >
        <motion.div
          style={{ scale: correctScale }}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold tracking-wider text-white uppercase shadow-xs"
        >
          <Check className="h-4 w-4 stroke-[3]" />
          <span>Верно (+1)</span>
        </motion.div>
      </motion.div>

      <motion.div
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[1.5rem] border-2 border-rose-500/80 bg-rose-500/[0.08]"
        style={{ opacity: skipOverlayOpacity }}
      >
        <motion.div
          style={{ scale: skipScale }}
          className="flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold tracking-wider text-white uppercase shadow-xs"
        >
          <X className="h-4 w-4 stroke-[3]" />
          <span>Пропуск (0)</span>
        </motion.div>
      </motion.div>

      <div
        className={[
          "alias-word-hints text-muted flex gap-3 text-xs font-semibold select-none",
          isCompactLandscape ? "mb-2" : "mb-5",
        ].join(" ")}
      >
        <span className="inline-flex items-center gap-1">
          <Icon icon={ArrowDown} size="xs" decorative />
          верно
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon icon={ArrowUp} size="xs" decorative />
          пропуск
        </span>
      </div>
      <div
        className={[
          "alias-word-text text-strong w-full max-w-full px-2 leading-tight font-black text-balance [overflow-wrap:anywhere] break-words [hyphens:auto]",
          isCompactLandscape
            ? "text-[clamp(2rem,12vh,3.6rem)]"
            : "text-[clamp(2.25rem,10vw,4rem)] sm:text-[clamp(3rem,8vw,4.5rem)]",
        ].join(" ")}
      >
        {word?.text}
      </div>
    </motion.div>
  );
};

const ExitConfirmationDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ open, onClose, onConfirm }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="w-full max-w-sm rounded-[1.5rem] border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-5 shadow-[var(--staffly-shadow)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-strong text-lg font-semibold">Завершить раунд?</div>
              <div className="text-muted mt-1 text-sm">Текущие ответы будут засчитаны как итог этого хода.</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 cursor-pointer"
              aria-label="Закрыть подтверждение"
              onClick={onClose}
            >
              <Icon icon={X} size="sm" />
            </Button>
          </div>
          <div className="mt-5 flex gap-2">
            <Button type="button" className="flex-1 cursor-pointer" onClick={onConfirm}>
              Завершить
            </Button>
            <Button type="button" variant="outline" className="flex-1 cursor-pointer" onClick={onClose}>
              Назад
            </Button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const AliasGameView: React.FC<AliasGameViewComponentProps> = ({ state, actions, isCompactLandscape = false }) => {
  const [exitConfirmationOpen, setExitConfirmationOpen] = React.useState(false);
  const [exitDirection, setExitDirection] = React.useState<ExitDirection>(null);

  const currentTeam = state.teams[state.currentTeamIndex] ?? null;
  const activeTeamId = currentTeam?.id ?? null;
  const roundScore = getAliasRoundScore(state.roundEvents);
  const lastRoundScore = getAliasRoundScore(state.lastRoundEvents);

  const handleCorrect = React.useCallback(() => {
    if (state.phase !== "playing") return;
    setExitDirection("down");
    actions.markCorrect();
  }, [actions, state.phase]);

  const handleSkip = React.useCallback(() => {
    if (state.phase !== "playing") return;
    setExitDirection("up");
    actions.markSkipped();
  }, [actions, state.phase]);

  React.useEffect(() => {
    setExitDirection(null);
  }, [state.currentWord?.id]);

  const handlePauseToggle = React.useCallback(() => {
    if (state.phase === "paused") {
      actions.resumeRound();
      return;
    }

    actions.pauseRound();
  }, [actions, state.phase]);

  const handleStartRound = React.useCallback(() => {
    actions.startRound();
  }, [actions]);

  useAliasControls({
    enabled: !exitConfirmationOpen && (state.phase === "playing" || state.phase === "paused"),
    onCorrect: handleCorrect,
    onSkip: handleSkip,
    onPauseToggle: handlePauseToggle,
    onExitRequest: () => setExitConfirmationOpen(true),
  });

  const handleConfirmExit = React.useCallback(() => {
    setExitConfirmationOpen(false);
    actions.finishRound();
  }, [actions]);

  if (!currentTeam && state.phase !== "gameOver") {
    return null;
  }

  const contentWidthClassName = isCompactLandscape
    ? "h-full w-full max-w-full min-h-0 gap-[0.45rem] pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(3.5rem,env(safe-area-inset-right))] pb-[max(0.6rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]"
    : state.phase === "roundSummary"
      ? "max-w-6xl"
      : "max-w-2xl";

  return (
    <div
      className={[
        "alias-game-view relative z-10 flex w-full flex-col gap-4 transition-[max-width] duration-200",
        contentWidthClassName,
      ].join(" ")}
    >
      <Scoreboard
        teams={state.teams}
        activeTeamId={activeTeamId}
        targetScore={state.settings.targetScore}
        isCompactLandscape={isCompactLandscape}
      />

      {state.phase === "ready" && currentTeam ? (
        <section
          className={[
            "alias-ready-panel flex flex-col items-center justify-center border border-[var(--staffly-border)] bg-[var(--staffly-surface)] text-center shadow-sm",
            isCompactLandscape
              ? "min-h-0 flex-1 rounded-none border-none bg-transparent p-4 shadow-none"
              : "min-h-[360px] rounded-[1.75rem] p-6",
          ].join(" ")}
        >
          <div className="text-muted text-sm font-medium">Ход команды</div>
          <h2
            className={[
              "text-strong max-w-full truncate font-bold",
              isCompactLandscape ? "mt-1 text-2xl" : "mt-2 text-4xl sm:text-5xl",
            ].join(" ")}
          >
            {currentTeam.name}
          </h2>
          <div className={["text-muted text-sm", isCompactLandscape ? "mt-1" : "mt-3"].join(" ")}>
            {state.settings.roundDurationSeconds} секунд, верно +1, пропуск 0
          </div>
          <div className={["flex w-full max-w-xs flex-col gap-2", isCompactLandscape ? "mt-3" : "mt-6"].join(" ")}>
            <Button
              type="button"
              size={isCompactLandscape ? "sm" : "lg"}
              className="w-full cursor-pointer"
              leftIcon={<Icon icon={Play} size="sm" decorative />}
              onClick={handleStartRound}
            >
              Старт раунда
            </Button>
          </div>
        </section>
      ) : null}

      {(state.phase === "playing" || state.phase === "paused") && currentTeam ? (
        <section
          className={[
            "alias-playing-panel relative overflow-hidden border border-[var(--staffly-border)] bg-[var(--staffly-surface)] shadow-sm",
            isCompactLandscape
              ? "grid flex-1 grid-cols-[minmax(18rem,1fr)_minmax(10rem,13rem)] grid-rows-[auto_minmax(0,1fr)] gap-[0.55rem] rounded-none border-none bg-transparent p-0 shadow-none"
              : "rounded-[1.75rem] p-4 sm:p-5",
          ].join(" ")}
        >
          <div
            className={[
              "alias-round-header flex flex-wrap items-center justify-between gap-3",
              isCompactLandscape ? "col-start-2 row-start-1 mb-0 items-start gap-[0.4rem]" : "mb-4",
            ].join(" ")}
          >
            <div>
              <div className={["text-muted font-medium", isCompactLandscape ? "text-[10px]" : "text-xs"].join(" ")}>
                Объясняет
              </div>
              <div className={["text-strong font-semibold", isCompactLandscape ? "text-sm" : "text-lg"].join(" ")}>
                {currentTeam.name}
              </div>
            </div>
            <div
              className={[
                "alias-round-metrics flex items-center",
                isCompactLandscape ? "w-full gap-[0.4rem]" : "gap-2",
              ].join(" ")}
            >
              <div
                className={[
                  "alias-round-metric bg-app border border-[var(--staffly-border)] text-center",
                  isCompactLandscape ? "flex-1 rounded-[0.6rem] px-1.5 py-1" : "rounded-2xl px-4 py-2",
                ].join(" ")}
              >
                <div
                  className={[
                    "text-muted font-semibold tracking-wide uppercase",
                    isCompactLandscape ? "text-[8px]" : "text-[10px]",
                  ].join(" ")}
                >
                  Время
                </div>
                <div
                  className={[
                    "text-strong leading-none font-bold",
                    isCompactLandscape ? "text-[1.15rem]" : "text-2xl",
                  ].join(" ")}
                >
                  {state.remainingSeconds}
                </div>
              </div>
              <div
                className={[
                  "alias-round-metric bg-app border border-[var(--staffly-border)] text-center",
                  isCompactLandscape ? "flex-1 rounded-[0.6rem] px-1.5 py-1" : "rounded-2xl px-4 py-2",
                ].join(" ")}
              >
                <div
                  className={[
                    "text-muted font-semibold tracking-wide uppercase",
                    isCompactLandscape ? "text-[8px]" : "text-[10px]",
                  ].join(" ")}
                >
                  Раунд
                </div>
                <div
                  className={[
                    "text-strong leading-none font-bold",
                    isCompactLandscape ? "text-[1.15rem]" : "text-2xl",
                  ].join(" ")}
                >
                  {roundScore}
                </div>
              </div>
            </div>
          </div>

          <div
            className={[
              "alias-word-stage relative flex items-center justify-center overflow-hidden",
              isCompactLandscape
                ? "col-start-1 row-span-2 row-start-1 m-0 h-full min-h-0 rounded-[1.1rem]"
                : "my-4 min-h-[280px] rounded-[1.5rem] sm:min-h-[340px]",
            ].join(" ")}
          >
            <AnimatePresence mode="popLayout">
              {state.phase === "paused" ? (
                <PausedRoundCard onResume={actions.resumeRound} onExit={() => setExitConfirmationOpen(true)} />
              ) : (
                <WordCard
                  key={state.currentWord?.id ?? "empty-word"}
                  word={state.currentWord}
                  exitDirection={exitDirection}
                  isCompactLandscape={isCompactLandscape}
                  onCorrect={handleCorrect}
                  onSkip={handleSkip}
                />
              )}
            </AnimatePresence>
          </div>

          <div
            className={[
              "alias-action-grid grid gap-2",
              isCompactLandscape ? "col-start-2 row-start-2 mt-0 grid-cols-1 self-end" : "mt-4 sm:grid-cols-3",
            ].join(" ")}
          >
            <Button
              type="button"
              size={isCompactLandscape ? "sm" : "lg"}
              className={["cursor-pointer", isCompactLandscape ? "h-8.5 min-h-[2.125rem] py-1 text-xs" : ""].join(" ")}
              leftIcon={<Icon icon={Check} size="sm" decorative />}
              onClick={handleCorrect}
            >
              Верно
            </Button>
            <Button
              type="button"
              variant="outline"
              size={isCompactLandscape ? "sm" : "lg"}
              className={["cursor-pointer", isCompactLandscape ? "h-8.5 min-h-[2.125rem] py-1 text-xs" : ""].join(" ")}
              leftIcon={<Icon icon={SkipForward} size="sm" decorative />}
              onClick={handleSkip}
            >
              Пропуск
            </Button>
            <Button
              type="button"
              variant="ghost"
              size={isCompactLandscape ? "sm" : "lg"}
              className={["cursor-pointer", isCompactLandscape ? "h-8.5 min-h-[2.125rem] py-1 text-xs" : ""].join(" ")}
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
          className={[
            "alias-summary-panel border border-[var(--staffly-border)] bg-[var(--staffly-surface)] shadow-sm",
            isCompactLandscape
              ? "grid min-h-0 flex-1 grid-cols-[minmax(18rem,1fr)_minmax(12rem,17rem)] grid-rows-[auto_minmax(0,1fr)] gap-[0.65rem] overflow-hidden rounded-none border-none bg-transparent p-0 shadow-none"
              : "rounded-[1.75rem] p-5 sm:p-6",
          ].join(" ")}
          initial={{ opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        >
          <div
            className={[
              "alias-summary-header flex flex-col",
              isCompactLandscape
                ? "col-start-2 row-start-1 gap-2"
                : "gap-4 sm:flex-row sm:items-end sm:justify-between",
            ].join(" ")}
          >
            <div>
              <div className={["text-muted font-medium", isCompactLandscape ? "text-[11px]" : "text-sm"].join(" ")}>
                Итог раунда
              </div>
              <h2
                className={["text-strong font-bold", isCompactLandscape ? "text-xl leading-tight" : "text-3xl"].join(
                  " ",
                )}
              >
                {state.lastRoundTeam.name}
              </h2>
            </div>
            <div
              className={[
                "rounded-xl border border-[var(--staffly-border)] bg-[var(--staffly-control)]/45 text-center",
                isCompactLandscape ? "min-w-[4rem] px-2 py-1" : "min-w-[5.5rem] px-4 py-2.5",
              ].join(" ")}
            >
              <div
                className={[
                  "text-muted font-semibold tracking-wide uppercase",
                  isCompactLandscape ? "text-[8px]" : "text-[10px]",
                ].join(" ")}
              >
                Очки
              </div>
              <MotionDiv
                key={lastRoundScore}
                className={["text-strong leading-none font-bold", isCompactLandscape ? "text-xl" : "text-3xl"].join(
                  " ",
                )}
                initial={{ scale: 0.94 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
              >
                {lastRoundScore > 0 ? `+${lastRoundScore}` : lastRoundScore}
              </MotionDiv>
            </div>
          </div>
          <div
            className={[
              "alias-summary-events",
              isCompactLandscape ? "col-start-1 row-span-2 row-start-1 mt-0 min-h-0" : "mt-5",
            ].join(" ")}
          >
            <RoundEventsList
              events={state.lastRoundEvents}
              isCompactLandscape={isCompactLandscape}
              onReview={actions.reviewLastRoundEvent}
            />
          </div>
          <div
            className={[
              "alias-summary-actions flex flex-col gap-2",
              isCompactLandscape ? "col-start-2 row-start-2 mt-0 self-end" : "mt-5 sm:flex-row",
            ].join(" ")}
          >
            <Button
              type="button"
              size={isCompactLandscape ? "sm" : "lg"}
              className={[
                "alias-summary-action-button flex-1 cursor-pointer font-semibold",
                isCompactLandscape ? "rounded-xl px-3 text-sm leading-[1.05] whitespace-normal" : "rounded-2xl text-lg",
              ].join(" ")}
              style={
                isCompactLandscape
                  ? { height: "2.375rem", minHeight: "2.375rem", borderRadius: "10px", fontSize: "13px" }
                  : { height: "3.5rem", minHeight: "3.5rem" }
              }
              leftIcon={
                <Icon
                  icon={state.winnerTeam ? Trophy : Flag}
                  size={isCompactLandscape ? "sm" : "md"}
                  className={isCompactLandscape ? "h-4 w-4" : "h-6 w-6"}
                  decorative
                />
              }
              onClick={state.winnerTeam ? actions.completeGame : actions.nextTurn}
            >
              {state.winnerTeam ? "Завершить игру" : "Следующая команда"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size={isCompactLandscape ? "sm" : "lg"}
              className={[
                "alias-summary-action-button flex-1 cursor-pointer font-semibold",
                isCompactLandscape ? "rounded-xl px-3 text-sm leading-[1.05] whitespace-normal" : "rounded-2xl text-lg",
              ].join(" ")}
              style={
                isCompactLandscape
                  ? { height: "2.375rem", minHeight: "2.375rem", borderRadius: "10px", fontSize: "13px" }
                  : { height: "3.5rem", minHeight: "3.5rem" }
              }
              leftIcon={
                <Icon
                  icon={RotateCcw}
                  size={isCompactLandscape ? "sm" : "md"}
                  className={isCompactLandscape ? "h-4 w-4" : "h-6 w-6"}
                  decorative
                />
              }
              onClick={actions.resetGame}
            >
              Новая игра
            </Button>
          </div>
        </MotionSection>
      ) : null}

      {state.phase === "gameOver" && state.winnerTeam ? (
        <section
          className={[
            "alias-game-over-panel flex flex-col items-center justify-center border border-[var(--staffly-border)] bg-[var(--staffly-surface)] text-center shadow-sm",
            isCompactLandscape
              ? "min-h-0 flex-1 rounded-none border-none bg-transparent p-4 shadow-none"
              : "min-h-[360px] rounded-[1.75rem] p-8",
          ].join(" ")}
        >
          <div className="relative flex items-center justify-center">
            <Icon
              icon={Trophy}
              size="lg"
              className="h-16 w-16 animate-[pulse_2s_infinite] text-amber-500 drop-shadow-[0_0_24px_rgba(245,158,11,0.35)]"
              decorative
            />
          </div>
          <div className="text-muted mt-5 text-xs font-bold tracking-widest uppercase">Победитель</div>
          <h2
            className={[
              "max-w-full truncate font-extrabold tracking-tight text-[var(--staffly-text-strong)]",
              isCompactLandscape ? "mt-1 text-2xl" : "mt-2 text-4xl sm:text-5xl",
            ].join(" ")}
          >
            {state.winnerTeam.name}
          </h2>
          <div className={["text-muted text-sm font-medium", isCompactLandscape ? "mt-1" : "mt-3"].join(" ")}>
            Финальный счет:{" "}
            <span className="font-bold text-[var(--staffly-text-strong)]">{state.winnerTeam.score} очков</span>
          </div>
          <Button
            type="button"
            size={isCompactLandscape ? "sm" : "lg"}
            className={["w-full max-w-xs cursor-pointer", isCompactLandscape ? "mt-4" : "mt-8"].join(" ")}
            leftIcon={<Icon icon={RotateCcw} size="sm" decorative />}
            onClick={actions.resetGame}
          >
            Сыграть еще
          </Button>
        </section>
      ) : null}

      <ExitConfirmationDialog
        open={exitConfirmationOpen}
        onClose={() => setExitConfirmationOpen(false)}
        onConfirm={handleConfirmExit}
      />
    </div>
  );
};

export default AliasGameView;

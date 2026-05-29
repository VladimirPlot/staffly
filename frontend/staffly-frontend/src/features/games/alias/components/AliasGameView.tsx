import React from "react";
import { AnimatePresence, motion, type PanInfo, useMotionValue, useTransform } from "framer-motion";
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
type AliasGameViewComponentProps = AliasGameViewProps & {
  isCompactLandscape?: boolean;
};

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

type ExitDirection = "up" | "down" | null;

const Scoreboard: React.FC<{
  teams: AliasTeam[];
  activeTeamId: string | null;
  targetScore: number;
  isCompactLandscape?: boolean;
}> = ({
  teams,
  activeTeamId,
  targetScore,
  isCompactLandscape = false,
}) => (
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
              ? "w-[min(12rem,calc(50%-0.2rem))] rounded-[0.8rem] px-2.5 py-2"
              : "w-full p-3.5 sm:w-[min(20rem,calc(50%-0.2rem))] lg:w-80",
            isActive
              ? "border-[var(--staffly-text-strong)] bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)] shadow-md"
              : "text-default border-[var(--staffly-border)] bg-[var(--staffly-surface)] shadow-xs",
          ].join(" ")}
        >
          <div className="truncate text-xs font-semibold opacity-80">{team.name}</div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className={[isCompactLandscape ? "text-[1.15rem]" : "text-2xl", "leading-none font-bold"].join(" ")}>
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
                isCompactLandscape ? "whitespace-normal [overflow-wrap:anywhere]" : "truncate",
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
  const y = useMotionValue(0);
  const rotate = useTransform(y, [-150, 150], [-4, 4]);
  const opacity = useTransform(y, [-240, -160, 0, 160, 240], [0, 1, 1, 1, 0]);
  const correctOverlayOpacity = useTransform(y, [0, 120], [0, 1]);
  const skipOverlayOpacity = useTransform(y, [-120, 0], [1, 0]);
  const correctScale = useTransform(y, [0, 120], [0.8, 1]);
  const skipScale = useTransform(y, [-120, 0], [1, 0.8]);

  React.useEffect(() => {
    y.set(0);
  }, [word?.id, y]);

  const handleDragEnd = React.useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > 120) onCorrect();
      if (info.offset.y < -120) onSkip();
    },
    [onCorrect, onSkip],
  );

  return (
    <motion.div
      key={word?.id}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      style={{ y, rotate, opacity }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.96,
        y: exitDirection === "down" ? 280 : exitDirection === "up" ? -280 : 0,
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
          isCompactLandscape ? "text-[clamp(2rem,12vh,3.6rem)]" : "text-[clamp(2.25rem,10vw,4rem)] sm:text-[clamp(3rem,8vw,4.5rem)]",
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

  const { isTouchDevice } = useAliasDeviceMode();
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

  const motionControls = useAliasMotionControls({
    enabled: state.phase === "playing",
    onCorrect: handleCorrect,
    onSkip: handleSkip,
  });

  React.useEffect(() => {
    if (!isTouchDevice && motionControls.status === "active") {
      motionControls.disableMotionControls();
    }
  }, [isTouchDevice, motionControls]);

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
    motionControls.resetMotionBaseline();
    actions.startRound();
  }, [actions, motionControls]);

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
    ? "h-full max-w-[min(62rem,calc(100vw-5rem))] min-h-0 gap-[0.45rem]"
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
              ? "min-h-0 flex-1 rounded-[1.25rem] p-4"
              : "min-h-[360px] rounded-[1.75rem] p-6",
          ].join(" ")}
        >
          <div className="text-muted text-sm font-medium">Ход команды</div>
          <h2 className="text-strong mt-2 max-w-full truncate text-4xl font-bold sm:text-5xl">{currentTeam.name}</h2>
          <div className="text-muted mt-3 text-sm">
            {state.settings.roundDurationSeconds} секунд, верно +1, пропуск 0
          </div>
          <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full cursor-pointer"
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
                className="w-full cursor-pointer"
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
        <section
          className={[
            "alias-playing-panel relative overflow-hidden border border-[var(--staffly-border)] bg-[var(--staffly-surface)] shadow-sm",
            isCompactLandscape
              ? "grid flex-1 grid-cols-[minmax(18rem,1fr)_minmax(10rem,13rem)] grid-rows-[auto_minmax(0,1fr)] gap-[0.55rem] rounded-[1.25rem] p-[0.65rem]"
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
              <div className="text-muted text-xs font-medium">Объясняет</div>
              <div className="text-strong text-lg font-semibold">{currentTeam.name}</div>
            </div>
            <div className={["alias-round-metrics flex items-center", isCompactLandscape ? "w-full gap-[0.4rem]" : "gap-2"].join(" ")}>
              <div
                className={[
                  "alias-round-metric bg-app rounded-2xl border border-[var(--staffly-border)] text-center",
                  isCompactLandscape ? "flex-1 rounded-[0.9rem] px-2 py-2" : "px-4 py-2",
                ].join(" ")}
              >
                <div className="text-muted text-[10px] font-semibold tracking-wide uppercase">Время</div>
                <div className="text-strong text-2xl leading-none font-bold">{state.remainingSeconds}</div>
              </div>
              <div
                className={[
                  "alias-round-metric bg-app rounded-2xl border border-[var(--staffly-border)] text-center",
                  isCompactLandscape ? "flex-1 rounded-[0.9rem] px-2 py-2" : "px-4 py-2",
                ].join(" ")}
              >
                <div className="text-muted text-[10px] font-semibold tracking-wide uppercase">Раунд</div>
                <div className="text-strong text-2xl leading-none font-bold">{roundScore}</div>
              </div>
            </div>
          </div>

          <div
            className={[
              "alias-word-stage relative flex items-center justify-center overflow-hidden",
              isCompactLandscape
                ? "col-start-1 row-start-1 row-span-2 m-0 h-full min-h-0 rounded-[1.1rem]"
                : "my-4 min-h-[280px] rounded-[1.5rem] sm:min-h-[340px]",
            ].join(" ")}
          >
            <AnimatePresence mode="popLayout">
              {state.phase === "paused" ? (
                <PausedRoundCard onResume={actions.resumeRound} onExit={() => setExitConfirmationOpen(true)} />
              ) : (
                <WordCard
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
              isCompactLandscape ? "col-start-2 row-start-2 mt-0 self-end grid-cols-1" : "mt-4 sm:grid-cols-3",
            ].join(" ")}
          >
            <Button
              type="button"
              size="lg"
              className={["cursor-pointer", isCompactLandscape ? "min-h-11" : ""].join(" ")}
              leftIcon={<Icon icon={Check} size="sm" decorative />}
              onClick={handleCorrect}
            >
              Верно
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={["cursor-pointer", isCompactLandscape ? "min-h-11" : ""].join(" ")}
              leftIcon={<Icon icon={SkipForward} size="sm" decorative />}
              onClick={handleSkip}
            >
              Пропуск
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className={["cursor-pointer", isCompactLandscape ? "min-h-11" : ""].join(" ")}
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
              ? "grid min-h-0 flex-1 grid-cols-[minmax(18rem,1fr)_minmax(12rem,17rem)] grid-rows-[auto_minmax(0,1fr)] gap-[0.65rem] overflow-hidden rounded-[1.25rem] p-[0.8rem]"
              : "rounded-[1.75rem] p-5 sm:p-6",
          ].join(" ")}
          initial={{ opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        >
          <div
            className={[
              "alias-summary-header flex flex-col",
              isCompactLandscape ? "col-start-2 row-start-1 gap-2" : "gap-4 sm:flex-row sm:items-end sm:justify-between",
            ].join(" ")}
          >
            <div>
              <div className="text-muted text-sm font-medium">Итог раунда</div>
              <h2 className="text-strong text-3xl font-bold">{state.lastRoundTeam.name}</h2>
            </div>
            <div className="min-w-[5.5rem] rounded-xl border border-[var(--staffly-border)] bg-[var(--staffly-control)]/45 px-4 py-2.5 text-center">
              <div className="text-muted text-[10px] font-semibold tracking-wide uppercase">Очки</div>
              <MotionDiv
                key={lastRoundScore}
                className="text-strong text-3xl leading-none font-bold"
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
              isCompactLandscape ? "col-start-1 row-start-1 row-span-2 mt-0 min-h-0" : "mt-5",
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
              size="lg"
              className={[
                "alias-summary-action-button flex-1 cursor-pointer rounded-2xl text-lg font-semibold",
                isCompactLandscape ? "whitespace-normal px-3 leading-[1.05] [&>span:last-child]:whitespace-normal [&>span:last-child]:overflow-visible [&>span:last-child]:text-clip" : "",
              ].join(" ")}
              style={{ height: "3.5rem", minHeight: "3.5rem" }}
              leftIcon={<Icon icon={state.winnerTeam ? Trophy : Flag} size="md" className="h-6 w-6" decorative />}
              onClick={state.winnerTeam ? actions.completeGame : actions.nextTurn}
            >
              {state.winnerTeam ? "Завершить игру" : "Следующая команда"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={[
                "alias-summary-action-button flex-1 cursor-pointer rounded-2xl text-lg font-semibold",
                isCompactLandscape ? "whitespace-normal px-3 leading-[1.05] [&>span:last-child]:whitespace-normal [&>span:last-child]:overflow-visible [&>span:last-child]:text-clip" : "",
              ].join(" ")}
              style={{ height: "3.5rem", minHeight: "3.5rem" }}
              leftIcon={<Icon icon={RotateCcw} size="md" className="h-6 w-6" decorative />}
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
              ? "min-h-0 flex-1 rounded-[1.25rem] p-4"
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
          <h2 className="mt-2 max-w-full truncate text-4xl font-extrabold tracking-tight text-[var(--staffly-text-strong)] sm:text-5xl">
            {state.winnerTeam.name}
          </h2>
          <div className="text-muted mt-3 text-sm font-medium">
            Финальный счет:{" "}
            <span className="font-bold text-[var(--staffly-text-strong)]">{state.winnerTeam.score} очков</span>
          </div>
          <Button
            type="button"
            className="mt-8 w-full max-w-xs cursor-pointer"
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

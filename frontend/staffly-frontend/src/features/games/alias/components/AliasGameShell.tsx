import React from "react";
import { X } from "lucide-react";

import Icon from "../../../../shared/ui/Icon";
import AliasFullscreenButton from "./AliasFullscreenButton";
import type {
  AliasFullscreenMode,
  AliasFullscreenSupport,
  AliasFullscreenViewport,
  AliasOrientationLockState,
} from "../hooks/useAliasFullscreen";

type AliasGameShellProps = {
  children: React.ReactNode;
  gameShellRef: React.RefObject<HTMLDivElement | null>;
  fullscreenMode: AliasFullscreenMode;
  fullscreenSupport: AliasFullscreenSupport;
  fullscreenViewport: AliasFullscreenViewport;
  isCompactLandscape: boolean;
  orientationLockState: AliasOrientationLockState;
  showLandscapePrompt: boolean;
  installHintVisible: boolean;
  fullscreenError: string | null;
  onFullscreenToggle: () => Promise<void>;
  onInstallHintDismiss: () => void;
};

const AliasGameShell: React.FC<AliasGameShellProps> = ({
  children,
  gameShellRef,
  fullscreenMode,
  fullscreenSupport,
  fullscreenViewport,
  isCompactLandscape,
  orientationLockState,
  showLandscapePrompt,
  installHintVisible,
  fullscreenError,
  onFullscreenToggle,
  onInstallHintDismiss,
}) => {
  const isFullscreen = fullscreenMode !== "inline";
  const showInstallHint = installHintVisible || Boolean(fullscreenError);
  const landscapePromptTitle =
    orientationLockState === "failed" ? "Не удалось повернуть экран автоматически" : "Поверните телефон";
  const landscapePromptText =
    fullscreenSupport === "native"
      ? "Разрешите автоповорот и поверните устройство горизонтально, чтобы Алиас занял игровой экран."
      : "На iPhone Web App нельзя надежно зафиксировать ориентацию через браузер. Поверните устройство горизонтально для игрового режима.";

  const fullscreenStyle =
    isFullscreen && fullscreenViewport.width > 0 && fullscreenViewport.height > 0
      ? ({
          width: `${fullscreenViewport.width}px`,
          height: `${fullscreenViewport.height}px`,
          maxHeight: `${fullscreenViewport.height}px`,
        } as React.CSSProperties)
      : undefined;

  return (
    <section
      ref={gameShellRef}
      className={[
        "alias-game-shell flex items-center justify-center border border-[var(--staffly-border)] transition-all duration-300 ease-in-out",
        isFullscreen && isCompactLandscape
          ? "fixed inset-0 z-[100] items-stretch overflow-hidden overscroll-contain rounded-none border-0 bg-[var(--staffly-surface)] p-0"
          : isFullscreen
            ? "fixed inset-0 z-[100] h-screen w-screen items-start overflow-y-auto overscroll-contain rounded-none border-0 bg-[var(--staffly-bg)] px-[max(0.75rem,env(safe-area-inset-left))] pt-[max(3.5rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] supports-[height:100dvh]:h-[100dvh] sm:items-center sm:p-8 sm:pt-16"
            : "relative min-h-[520px] w-full overflow-hidden rounded-[2rem] bg-[var(--staffly-control)]/30 p-3 sm:min-h-[620px] sm:p-6",
      ].join(" ")}
      data-alias-fullscreen-mode={fullscreenMode}
      style={fullscreenStyle}
    >
      <AliasFullscreenButton
        fullscreenMode={fullscreenMode}
        fullscreenSupport={fullscreenSupport}
        onToggle={onFullscreenToggle}
      />
      {showInstallHint ? (
        <div
          className="absolute top-14 right-3 left-3 z-30 mx-auto max-w-xl rounded-2xl border border-[var(--staffly-border)] bg-[var(--staffly-surface)]/95 p-3 text-sm shadow-lg backdrop-blur sm:right-14 sm:left-auto sm:w-[26rem]"
          role="status"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-strong font-semibold">
                {fullscreenError ? "Не удалось открыть во весь экран" : "Полноэкранный режим на iPhone"}
              </div>
              <div className="text-muted mt-1 text-xs leading-relaxed">
                {fullscreenError ??
                  "В Safari или Chrome на iPhone откройте меню «Поделиться», выберите «На экран Домой», включите «Open as Web App» и запускайте Staffly с иконки. Тогда Алиас будет открываться без браузерной рамки."}
              </div>
            </div>
            <button
              type="button"
              className="text-muted hover:text-strong flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-[var(--staffly-control)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
              aria-label="Скрыть подсказку"
              onClick={onInstallHintDismiss}
            >
              <Icon icon={X} size="xs" decorative />
            </button>
          </div>
        </div>
      ) : null}
      {showLandscapePrompt ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--staffly-bg)]/95 p-6 text-center backdrop-blur">
          <div className="relative max-w-sm rounded-2xl border border-[var(--staffly-border)] bg-[var(--staffly-surface)] p-5 shadow-lg">
            <button
              type="button"
              className="text-muted hover:text-strong absolute top-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-[var(--staffly-control)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
              aria-label="Свернуть игровой режим"
              onClick={() => {
                void onFullscreenToggle();
              }}
            >
              <Icon icon={X} size="xs" decorative />
            </button>
            <div className="pr-6">
              <div className="text-muted text-xs font-bold tracking-widest uppercase">landscape</div>
              <div className="text-strong mt-2 text-2xl font-extrabold">{landscapePromptTitle}</div>
              <div className="text-muted mt-2 text-sm leading-relaxed">{landscapePromptText}</div>
            </div>
          </div>
        </div>
      ) : null}
      {children}
    </section>
  );
};

export default AliasGameShell;

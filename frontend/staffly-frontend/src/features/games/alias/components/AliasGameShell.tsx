import React from "react";

import AliasFullscreenButton from "./AliasFullscreenButton";

type AliasGameShellProps = {
  children: React.ReactNode;
  gameShellRef: React.RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
};

const AliasGameShell: React.FC<AliasGameShellProps> = ({
  children,
  gameShellRef,
  isFullscreen,
  onFullscreenToggle,
}) => {
  return (
    <section
      ref={gameShellRef}
      className={[
        "flex items-center justify-center border border-[var(--staffly-border)] transition-all duration-300 ease-in-out",
        isFullscreen
          ? "fixed inset-0 z-[100] h-screen w-screen items-start overflow-y-auto overscroll-contain rounded-none bg-[var(--staffly-bg)] px-3 pt-14 pb-[max(0.75rem,env(safe-area-inset-bottom))] supports-[height:100dvh]:h-[100dvh] sm:items-center sm:p-8 sm:pt-16"
          : "relative min-h-[520px] w-full overflow-hidden rounded-[2rem] bg-[var(--staffly-control)]/30 p-3 sm:min-h-[620px] sm:p-6",
      ].join(" ")}
    >
      <AliasFullscreenButton
        isFullscreen={isFullscreen}
        onToggle={() => {
          void onFullscreenToggle();
        }}
      />
      {children}
    </section>
  );
};

export default AliasGameShell;

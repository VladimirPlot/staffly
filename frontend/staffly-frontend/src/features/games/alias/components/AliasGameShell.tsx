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
        "relative flex items-center justify-center overflow-hidden border border-[var(--staffly-border)] shadow-[var(--staffly-shadow)] transition-all duration-300 ease-in-out",
        isFullscreen
          ? "min-h-screen w-screen rounded-none bg-[var(--staffly-bg)] p-3 pt-14 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-8 sm:pt-16"
          : "min-h-[520px] w-full rounded-[2rem] bg-[var(--staffly-control)]/30 p-3 sm:min-h-[620px] sm:p-6",
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

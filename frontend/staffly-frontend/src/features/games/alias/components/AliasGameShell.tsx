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
          ? "min-h-screen w-screen rounded-none bg-[var(--staffly-bg)] p-8 sm:p-12"
          : "min-h-[360px] w-full rounded-[2rem] bg-[var(--staffly-control)]/30 p-6 sm:min-h-[480px] sm:p-10",
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

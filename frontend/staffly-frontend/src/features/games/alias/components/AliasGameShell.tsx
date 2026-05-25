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
        "relative overflow-hidden border border-[var(--staffly-border)] bg-[var(--staffly-surface)] shadow-[var(--staffly-shadow)]",
        isFullscreen
          ? "flex min-h-screen w-screen items-center justify-center rounded-none p-3"
          : "mx-auto max-w-xl rounded-[1.5rem] p-3",
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

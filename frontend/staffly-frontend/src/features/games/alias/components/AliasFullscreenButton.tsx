import React from "react";
import { Info, Maximize2, Minimize2 } from "lucide-react";

import Icon from "../../../../shared/ui/Icon";
import IconButton from "../../../../shared/ui/IconButton";
import type { AliasFullscreenMode, AliasFullscreenSupport } from "../hooks/useAliasFullscreen";

type AliasFullscreenButtonProps = {
  fullscreenMode: AliasFullscreenMode;
  fullscreenSupport: AliasFullscreenSupport;
  onToggle: () => Promise<void>;
};

const AliasFullscreenButton: React.FC<AliasFullscreenButtonProps> = ({
  fullscreenMode,
  fullscreenSupport,
  onToggle,
}) => {
  const isFullscreen = fullscreenMode !== "inline";
  const isIosBrowser = fullscreenSupport === "iosBrowser";
  const label = isFullscreen
    ? "Свернуть игровое поле"
    : isIosBrowser
      ? "Как открыть Алиас без браузерной рамки"
      : "Открыть Алиас во весь экран";

  return (
    <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))] z-20">
      <IconButton
        aria-label={label}
        className="h-8 w-8 bg-[var(--staffly-surface)]/90 p-0 shadow-sm backdrop-blur transition-transform hover:scale-105 active:scale-95"
        title={label}
        onClick={() => {
          void onToggle();
        }}
      >
        <Icon icon={isFullscreen ? Minimize2 : isIosBrowser ? Info : Maximize2} size="sm" />
      </IconButton>
    </div>
  );
};

export default AliasFullscreenButton;

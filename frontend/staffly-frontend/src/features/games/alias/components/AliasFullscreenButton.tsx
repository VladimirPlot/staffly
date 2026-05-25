import React from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import Icon from "../../../../shared/ui/Icon";
import IconButton from "../../../../shared/ui/IconButton";

type AliasFullscreenButtonProps = {
  isFullscreen: boolean;
  onToggle: () => void;
};

const AliasFullscreenButton: React.FC<AliasFullscreenButtonProps> = ({ isFullscreen, onToggle }) => {
  return (
    <div className="absolute top-2 right-2 z-20">
      <IconButton
        aria-label={isFullscreen ? "Выйти из полноэкранного режима" : "Открыть во весь экран"}
        className="h-9 w-9 bg-[var(--staffly-surface)]/90 p-0 backdrop-blur"
        onClick={onToggle}
      >
        <Icon icon={isFullscreen ? Minimize2 : Maximize2} size="sm" />
      </IconButton>
    </div>
  );
};

export default AliasFullscreenButton;

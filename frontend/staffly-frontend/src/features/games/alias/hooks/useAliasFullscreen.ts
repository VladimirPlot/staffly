import React from "react";

export const useAliasFullscreen = () => {
  const gameShellRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const handleFullscreenChange = (): void => {
      setIsFullscreen(document.fullscreenElement === gameShellRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = React.useCallback(async () => {
    const shell = gameShellRef.current;
    if (!shell) return;

    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
        return;
      }

      await shell.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  }, []);

  return {
    gameShellRef,
    isFullscreen,
    toggleFullscreen,
  };
};

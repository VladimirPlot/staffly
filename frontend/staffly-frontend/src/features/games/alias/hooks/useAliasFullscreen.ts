import React from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const getFullscreenElement = () => {
  const fullscreenDocument = document as FullscreenDocument;
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
};

const exitNativeFullscreen = () => {
  const fullscreenDocument = document as FullscreenDocument;

  if (typeof document.exitFullscreen === "function") {
    void document.exitFullscreen();
    return;
  }

  if (typeof fullscreenDocument.webkitExitFullscreen === "function") {
    void fullscreenDocument.webkitExitFullscreen();
  }
};

const requestNativeFullscreen = (element: FullscreenElement) => {
  if (typeof element.requestFullscreen === "function") {
    void element.requestFullscreen({ navigationUI: "hide" }).catch(() => undefined);
    return;
  }

  if (typeof element.webkitRequestFullscreen === "function") {
    void element.webkitRequestFullscreen();
  }
};

export const useAliasFullscreen = () => {
  const gameShellRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const isGameModeRef = React.useRef(false);
  const isNativeFullscreenRef = React.useRef(false);

  React.useEffect(() => {
    const handleFullscreenChange = (): void => {
      const shell = gameShellRef.current;
      const isNativeFullscreen = Boolean(shell && getFullscreenElement() === shell);

      if (isNativeFullscreen) {
        isNativeFullscreenRef.current = true;
        isGameModeRef.current = true;
        setIsFullscreen(true);
        return;
      }

      if (isNativeFullscreenRef.current) {
        isNativeFullscreenRef.current = false;
        isGameModeRef.current = false;
        setIsFullscreen(false);
        return;
      }

      setIsFullscreen(isGameModeRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  React.useEffect(() => {
    if (!isFullscreen) return undefined;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousDocumentOverscrollBehavior = documentElement.style.overscrollBehavior;

    body.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior;
    };
  }, [isFullscreen]);

  const toggleFullscreen = React.useCallback(() => {
    const shell = gameShellRef.current;
    if (!shell) return;

    if (isFullscreen) {
      isGameModeRef.current = false;
      isNativeFullscreenRef.current = false;
      setIsFullscreen(false);

      if (getFullscreenElement() === shell) {
        exitNativeFullscreen();
      }

      return;
    }

    isGameModeRef.current = true;
    setIsFullscreen(true);
    requestNativeFullscreen(shell);
  }, [isFullscreen]);

  return {
    gameShellRef,
    isFullscreen,
    toggleFullscreen,
  };
};

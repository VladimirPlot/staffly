import React from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLDivElement & {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type AliasOrientationLockType = "any" | "natural" | "landscape" | "portrait" | OrientationType;

export type AliasFullscreenMode = "inline" | "native" | "webApp";
export type AliasFullscreenSupport = "native" | "iosWebApp" | "iosBrowser" | "browserFallback";
export type AliasOrientationLockState = "idle" | "locking" | "locked" | "unsupported" | "failed";
export type AliasFullscreenViewport = { width: number; height: number };

type AliasFullscreenEnvironment = {
  isIos: boolean;
  isMobile: boolean;
  isStandalone: boolean;
  supportsNativeFullscreen: boolean;
};

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: AliasOrientationLockType) => Promise<void>;
  unlock?: () => void;
};

const ALIAS_FULLSCREEN_VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

const getViewportMeta = () => {
  if (typeof document === "undefined") return null;

  return document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
};

const getFullscreenElement = () => {
  const fullscreenDocument = document as FullscreenDocument;
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
};

const getIsIos = () => {
  if (typeof navigator === "undefined") return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const getIsMobile = () => {
  if (typeof navigator === "undefined") return false;
  if (navigator.maxTouchPoints > 0) return true;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;

  return window.matchMedia("(pointer: coarse)").matches;
};

const getIsLandscape = () => {
  if (typeof window === "undefined") return true;
  if (typeof window.matchMedia === "function") return window.matchMedia("(orientation: landscape)").matches;

  return window.innerWidth > window.innerHeight;
};

const getDisplayModeMatches = (displayMode: "fullscreen" | "standalone" | "minimal-ui") => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;

  return window.matchMedia(`(display-mode: ${displayMode})`).matches;
};

const getIsStandalone = () => {
  if (typeof navigator === "undefined") return false;

  const standaloneNavigator = navigator as NavigatorWithStandalone;

  return (
    standaloneNavigator.standalone === true ||
    getDisplayModeMatches("fullscreen") ||
    getDisplayModeMatches("standalone") ||
    getDisplayModeMatches("minimal-ui")
  );
};

const getViewportSize = (): AliasFullscreenViewport => {
  if (typeof window === "undefined") return { width: 0, height: 0 };

  return {
    width: Math.round(window.visualViewport?.width ?? window.innerWidth),
    height: Math.round(window.visualViewport?.height ?? window.innerHeight),
  };
};

const getSupportsNativeFullscreen = () => {
  if (typeof document === "undefined") return false;

  const fullscreenDocument = document as FullscreenDocument;
  return Boolean(document.fullscreenEnabled || fullscreenDocument.webkitFullscreenEnabled);
};

const getEnvironment = (): AliasFullscreenEnvironment => ({
  isIos: getIsIos(),
  isMobile: getIsMobile(),
  isStandalone: getIsStandalone(),
  supportsNativeFullscreen: getSupportsNativeFullscreen(),
});

const getSupport = ({
  isIos,
  isStandalone,
  supportsNativeFullscreen,
}: AliasFullscreenEnvironment): AliasFullscreenSupport => {
  if (isIos && isStandalone) return "iosWebApp";
  if (isIos) return "iosBrowser";
  if (supportsNativeFullscreen) return "native";

  return "browserFallback";
};

const exitNativeFullscreen = async () => {
  const fullscreenDocument = document as FullscreenDocument;

  if (typeof document.exitFullscreen === "function") {
    await document.exitFullscreen();
    return;
  }

  if (typeof fullscreenDocument.webkitExitFullscreen === "function") {
    await fullscreenDocument.webkitExitFullscreen();
  }
};

const requestNativeFullscreen = async (element: FullscreenElement) => {
  if (typeof element.requestFullscreen === "function") {
    await element.requestFullscreen({ navigationUI: "hide" });
    return;
  }

  if (typeof element.webkitRequestFullscreen === "function") {
    await element.webkitRequestFullscreen();
  }
};

const getScreenOrientation = () => {
  if (typeof screen === "undefined") return null;

  return screen.orientation as ScreenOrientationWithLock | undefined;
};

const lockPortraitOrientation = async () => {
  const orientation = getScreenOrientation();

  if (typeof orientation?.lock !== "function") return false;

  await orientation.lock("portrait");
  return true;
};

const unlockOrientation = () => {
  const orientation = getScreenOrientation();
  if (typeof orientation?.unlock !== "function") return;

  orientation.unlock();
};

export const useAliasFullscreen = () => {
  const gameShellRef = React.useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = React.useState<AliasFullscreenMode>("inline");
  const [environment, setEnvironment] = React.useState<AliasFullscreenEnvironment>(() => getEnvironment());
  const [isLandscape, setIsLandscape] = React.useState(() => getIsLandscape());
  const [installHintVisible, setInstallHintVisible] = React.useState(false);
  const [fullscreenError, setFullscreenError] = React.useState<string | null>(null);
  const [orientationLockState, setOrientationLockState] = React.useState<AliasOrientationLockState>("idle");
  const [viewportSize, setViewportSize] = React.useState<AliasFullscreenViewport>(() => getViewportSize());

  const support = getSupport(environment);
  const isFullscreen = mode !== "inline";
  const isFullscreenLayout = isFullscreen && environment.isMobile;
  const showPortraitPrompt =
    isFullscreen &&
    environment.isMobile &&
    isLandscape &&
    orientationLockState !== "locking" &&
    orientationLockState !== "locked";

  React.useEffect(() => {
    const handleFullscreenChange = (): void => {
      const shell = gameShellRef.current;
      const isNativeFullscreen = Boolean(shell && getFullscreenElement() === shell);

      if (isNativeFullscreen) {
        setMode("native");
        return;
      }

      setMode((currentMode) => (currentMode === "native" ? "inline" : currentMode));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const viewport = window.visualViewport;
    const updateViewportSize = () => setViewportSize(getViewportSize());

    updateViewportSize();
    viewport?.addEventListener("resize", updateViewportSize);
    viewport?.addEventListener("scroll", updateViewportSize);
    window.addEventListener("resize", updateViewportSize);
    window.addEventListener("orientationchange", updateViewportSize);

    return () => {
      viewport?.removeEventListener("resize", updateViewportSize);
      viewport?.removeEventListener("scroll", updateViewportSize);
      window.removeEventListener("resize", updateViewportSize);
      window.removeEventListener("orientationchange", updateViewportSize);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateOrientation = () => setIsLandscape(getIsLandscape());
    const orientationQuery =
      typeof window.matchMedia === "function" ? window.matchMedia("(orientation: landscape)") : null;
    const screenOrientation = getScreenOrientation();

    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    orientationQuery?.addEventListener("change", updateOrientation);
    screenOrientation?.addEventListener("change", updateOrientation);

    return () => {
      window.removeEventListener("resize", updateOrientation);
      orientationQuery?.removeEventListener("change", updateOrientation);
      screenOrientation?.removeEventListener("change", updateOrientation);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;

    const displayModeQueries = [
      window.matchMedia("(display-mode: fullscreen)"),
      window.matchMedia("(display-mode: standalone)"),
      window.matchMedia("(display-mode: minimal-ui)"),
    ];
    const updateEnvironment = () => setEnvironment(getEnvironment());

    displayModeQueries.forEach((query) => query.addEventListener("change", updateEnvironment));
    return () => displayModeQueries.forEach((query) => query.removeEventListener("change", updateEnvironment));
  }, []);

  React.useEffect(() => {
    if (support !== "iosBrowser") {
      setInstallHintVisible(false);
    }
  }, [support]);

  React.useEffect(() => {
    if (!isFullscreen) return undefined;

    const { body, documentElement } = document;
    const viewportMeta = getViewportMeta();
    const previousViewportContent = viewportMeta?.getAttribute("content") ?? null;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    const previousDocumentOverscrollBehavior = documentElement.style.overscrollBehavior;

    viewportMeta?.setAttribute("content", ALIAS_FULLSCREEN_VIEWPORT_CONTENT);
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    documentElement.style.overscrollBehavior = "none";

    return () => {
      if (previousViewportContent) {
        viewportMeta?.setAttribute("content", previousViewportContent);
      }

      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior;
    };
  }, [isFullscreen]);

  React.useEffect(() => {
    if (isFullscreen) return undefined;

    setOrientationLockState("idle");
    return undefined;
  }, [isFullscreen]);

  React.useEffect(() => () => unlockOrientation(), []);

  const requestPortraitLock = React.useCallback(async () => {
    if (!environment.isMobile) return;

    setOrientationLockState("locking");

    try {
      const locked = await lockPortraitOrientation();
      setOrientationLockState(locked ? "locked" : "unsupported");
    } catch {
      setOrientationLockState("failed");
    }
  }, [environment.isMobile]);

  const exitFullscreen = React.useCallback(async () => {
    const shell = gameShellRef.current;

    setInstallHintVisible(false);
    setFullscreenError(null);
    setOrientationLockState("idle");
    unlockOrientation();

    if (mode === "native" && shell && getFullscreenElement() === shell) {
      try {
        await exitNativeFullscreen();
      } catch {
        setMode("inline");
      }

      return;
    }

    setMode("inline");
  }, [mode]);

  const enterFullscreen = React.useCallback(async () => {
    const shell = gameShellRef.current;
    if (!shell) return;

    setFullscreenError(null);

    if (support === "iosBrowser") {
      setInstallHintVisible(true);
      return;
    }

    if (support === "iosWebApp" || support === "browserFallback") {
      setInstallHintVisible(false);
      setMode("webApp");
      void requestPortraitLock();
      return;
    }

    try {
      await requestNativeFullscreen(shell);
      if (getFullscreenElement() === shell) {
        setInstallHintVisible(false);
        setMode("native");
        await requestPortraitLock();
      }
    } catch {
      setFullscreenError("Браузер не разрешил полноэкранный режим. Попробуйте открыть игру из установленного Web App.");
    }
  }, [requestPortraitLock, support]);

  const toggleFullscreen = React.useCallback(async () => {
    if (mode === "inline") {
      await enterFullscreen();
      return;
    }

    await exitFullscreen();
  }, [enterFullscreen, exitFullscreen, mode]);

  return {
    gameShellRef,
    isFullscreen,
    isFullscreenLayout,
    isLandscape,
    fullscreenViewport: viewportSize,
    fullscreenMode: mode,
    fullscreenSupport: support,
    orientationLockState,
    showPortraitPrompt,
    installHintVisible,
    fullscreenError,
    toggleFullscreen,
    dismissInstallHint: () => setInstallHintVisible(false),
  };
};

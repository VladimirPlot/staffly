import React from "react";

import { ALIAS_SWIPE_DISTANCE_THRESHOLD, ALIAS_SWIPE_VELOCITY_THRESHOLD } from "../constants";

type AliasControlsOptions = {
  enabled: boolean;
  onCorrect: () => void;
  onSkip: () => void;
  onPauseToggle: () => void;
  onExitRequest: () => void;
};

type PointerStart = {
  id: number;
  y: number;
  time: number;
};

export const useAliasControls = ({
  enabled,
  onCorrect,
  onSkip,
  onPauseToggle,
  onExitRequest,
}: AliasControlsOptions) => {
  const pointerStartRef = React.useRef<PointerStart | null>(null);

  React.useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === "Enter" || event.key === "ArrowUp") {
        event.preventDefault();
        onCorrect();
      }

      if (event.key === "Backspace" || event.key === "ArrowDown") {
        event.preventDefault();
        onSkip();
      }

      if (event.key === " ") {
        event.preventDefault();
        onPauseToggle();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onExitRequest();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onCorrect, onExitRequest, onPauseToggle, onSkip]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || !event.isPrimary) return;

      pointerStartRef.current = {
        id: event.pointerId,
        y: event.clientY,
        time: performance.now(),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [enabled],
  );

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const pointerStart = pointerStartRef.current;
      pointerStartRef.current = null;

      if (!enabled || !pointerStart || pointerStart.id !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const distance = event.clientY - pointerStart.y;
      const elapsed = Math.max(1, performance.now() - pointerStart.time);
      const velocity = Math.abs(distance) / elapsed;
      const isIntentionalSwipe =
        Math.abs(distance) >= ALIAS_SWIPE_DISTANCE_THRESHOLD || velocity >= ALIAS_SWIPE_VELOCITY_THRESHOLD;

      if (!isIntentionalSwipe) return;

      if (distance < 0) {
        onCorrect();
      } else {
        onSkip();
      }
    },
    [enabled, onCorrect, onSkip],
  );

  const handlePointerCancel = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    pointerStartRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return {
    cardHandlers: {
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
};

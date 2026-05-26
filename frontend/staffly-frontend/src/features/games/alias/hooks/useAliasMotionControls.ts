import React from "react";

type MotionStatus = "idle" | "active" | "denied" | "unsupported";

type DeviceOrientationPermissionState = "granted" | "denied" | "prompt";

type DeviceOrientationEventConstructorWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<DeviceOrientationPermissionState>;
};

type AliasMotionControlsOptions = {
  enabled: boolean;
  onCorrect: () => void;
  onSkip: () => void;
};

const TILT_THRESHOLD_DEGREES = 22;
const TILT_DEBOUNCE_MS = 900;

export const useAliasMotionControls = ({ enabled, onCorrect, onSkip }: AliasMotionControlsOptions) => {
  const [status, setStatus] = React.useState<MotionStatus>("idle");
  const neutralBetaRef = React.useRef<number | null>(null);
  const lastActionAtRef = React.useRef(0);

  const requestMotionPermission = React.useCallback(async () => {
    if (!("DeviceOrientationEvent" in window)) {
      setStatus("unsupported");
      return;
    }

    const orientationEvent = window.DeviceOrientationEvent as DeviceOrientationEventConstructorWithPermission;

    if (typeof orientationEvent.requestPermission === "function") {
      try {
        const permission = await orientationEvent.requestPermission();
        setStatus(permission === "granted" ? "active" : "denied");
      } catch {
        setStatus("denied");
      }

      return;
    }

    setStatus("active");
  }, []);

  React.useEffect(() => {
    if (!enabled || status !== "active") return undefined;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (typeof event.beta !== "number") return;

      if (neutralBetaRef.current === null) {
        neutralBetaRef.current = event.beta;
        return;
      }

      const now = performance.now();
      if (now - lastActionAtRef.current < TILT_DEBOUNCE_MS) return;

      const delta = event.beta - neutralBetaRef.current;

      if (delta > TILT_THRESHOLD_DEGREES) {
        lastActionAtRef.current = now;
        neutralBetaRef.current = event.beta;
        onCorrect();
      }

      if (delta < -TILT_THRESHOLD_DEGREES) {
        lastActionAtRef.current = now;
        neutralBetaRef.current = event.beta;
        onSkip();
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);

    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [enabled, onCorrect, onSkip, status]);

  const resetMotionBaseline = React.useCallback(() => {
    neutralBetaRef.current = null;
  }, []);

  return {
    status,
    requestMotionPermission,
    resetMotionBaseline,
  };
};

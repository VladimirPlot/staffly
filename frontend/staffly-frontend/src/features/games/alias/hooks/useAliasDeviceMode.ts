import React from "react";

export const useAliasDeviceMode = () => {
  const [isTouchDevice, setIsTouchDevice] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;

    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const updateDeviceMode = () => {
      setIsTouchDevice(coarsePointerQuery.matches || "ontouchstart" in window || navigator.maxTouchPoints > 0);
    };

    updateDeviceMode();
    coarsePointerQuery.addEventListener("change", updateDeviceMode);

    return () => coarsePointerQuery.removeEventListener("change", updateDeviceMode);
  }, []);

  return { isTouchDevice };
};

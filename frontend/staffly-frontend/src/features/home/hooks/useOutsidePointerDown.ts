import React from "react";

type OutsidePointerDownOptions = {
  enabled: boolean;
  insideSelector: string;
  onOutside: (event: PointerEvent) => void;
};

export function useOutsidePointerDown({
  enabled,
  insideSelector,
  onOutside,
}: OutsidePointerDownOptions) {
  React.useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(insideSelector)) return;
      onOutside(event);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [enabled, insideSelector, onOutside]);
}

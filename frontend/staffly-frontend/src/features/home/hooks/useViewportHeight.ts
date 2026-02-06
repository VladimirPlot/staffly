import React from "react";

export function useViewportHeight() {
  const [height, setHeight] = React.useState(() => {
    if (typeof window === "undefined") return 0;
    return window.visualViewport?.height ?? window.innerHeight;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      setHeight(window.visualViewport?.height ?? window.innerHeight);
    };

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    update();

    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return height;
}

import React from "react";

export function useMeasuredHeight<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [height, setHeight] = React.useState(0);

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      setHeight(node.getBoundingClientRect().height);
    };

    update();

    const observer = new ResizeObserver(() => update());
    observer.observe(node);

    return () => observer.disconnect();
  }, [ref]);

  return height;
}

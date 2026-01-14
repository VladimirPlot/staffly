export const getFocusableElements = (container: HTMLElement | null) => {
  if (!container) return [];
  const selectors = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];
  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(","))).filter(
    (element) => !element.hasAttribute("disabled") && !element.getAttribute("aria-hidden")
  );
};

export type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export const arrowKeys: ArrowKey[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

export function isEditableElement(element: HTMLElement | null): boolean {
  if (!element) return false;
  const ariaDisabled = element.getAttribute("aria-disabled");
  if (ariaDisabled === "true") return false;
  if ("disabled" in element) {
    return !(element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).disabled;
  }
  return true;
}

export function shouldHandleHorizontalArrow(event: {
  key: ArrowKey;
  ctrlKey: boolean;
  metaKey: boolean;
  currentTarget: EventTarget & HTMLElement;
}): boolean {
  if (event.ctrlKey || event.metaKey) return true;

  const target = event.currentTarget;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return true;
  }

  const value = target.value ?? "";
  const selectionStart = target.selectionStart;
  const selectionEnd = target.selectionEnd;

  if (value.length === 0) return true;
  if (selectionStart === null || selectionEnd === null) return true;

  if (event.key === "ArrowLeft") {
    return selectionStart === 0;
  }

  return selectionEnd === value.length;
}

export function isArrowKey(key: string): key is ArrowKey {
  return arrowKeys.includes(key as ArrowKey);
}

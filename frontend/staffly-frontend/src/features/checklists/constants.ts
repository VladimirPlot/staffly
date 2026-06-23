import type { ChecklistItemSectionKey } from "./types";

export const CHECKLIST_ITEM_TABS: { key: ChecklistItemSectionKey; label: string }[] = [
  { key: "available", label: "Не взяты" },
  { key: "reserved", label: "В работе" },
  { key: "done", label: "Готово" },
];

export const EMPTY_ITEM_TAB_MESSAGES: Record<ChecklistItemSectionKey, string> = {
  available: "Нет свободных пунктов. Все задачи взяты в работу или завершены!",
  reserved: "Нет пунктов в работе. Возьмите задачу во вкладке «Не взяты».",
  done: "Нет завершенных пунктов. Выполните задачи из вкладки «В работе».",
};

export const PANEL_COLLAPSED = { height: 0, opacity: 0 } as const;
export const PANEL_EXPANDED = { height: "auto", opacity: 1 } as const;
export const TAB_CONTENT_ENTER = { opacity: 0, y: 6 } as const;
export const TAB_CONTENT_VISIBLE = { opacity: 1, y: 0 } as const;
export const TAB_CONTENT_EXIT = { opacity: 0, y: -6 } as const;
export const EXPANDED_PANEL_TRANSITION = { duration: 0.22, ease: "easeInOut" } as const;
export const ACTIVE_TAB_TRANSITION = { type: "spring", stiffness: 380, damping: 30 } as const;
export const TAB_CONTENT_TRANSITION = { duration: 0.14, ease: "easeOut" } as const;

export const CHECKLIST_SCROLL_DELAY_MS = 260;
export const CHECKLIST_SCROLL_TOP_OFFSET_RATIO = 0.12;
export const CHECKLIST_SCROLL_CENTER_MAX_HEIGHT_RATIO = 0.82;

export const CHECKLIST_PROGRESS_RADIUS = 7;
export const CHECKLIST_PROGRESS_CIRCUMFERENCE = 2 * Math.PI * CHECKLIST_PROGRESS_RADIUS;

export const PANEL_COLLAPSED = { height: 0, opacity: 0 } as const;
export const PANEL_EXPANDED = { height: "auto", opacity: 1 } as const;
export const EXPANDED_PANEL_TRANSITION = { duration: 0.22, ease: "easeInOut" } as const;

export const CHECKLIST_SCROLL_DELAY_MS = 260;
export const CHECKLIST_SCROLL_TOP_OFFSET_RATIO = 0.12;
export const CHECKLIST_SCROLL_CENTER_MAX_HEIGHT_RATIO = 0.82;

export const CHECKLIST_PROGRESS_RADIUS = 7;
export const CHECKLIST_PROGRESS_CIRCUMFERENCE = 2 * Math.PI * CHECKLIST_PROGRESS_RADIUS;

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "staffly:theme";

export function isTheme(v: any): v is Theme {
  return v === "light" || v === "dark";
}

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(v) ? v : null;
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function applyThemeToDom(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

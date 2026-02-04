import React from "react";
import { fetchDashboardLayout, saveDashboardLayout } from "../api";

const DEFAULT_LAYOUT = [
  "employees",
  "announcements",
  "contacts",
  "anonymous-letter",
  "schedule",
  "master-schedule",
  "training",
  "tasks",
  "checklists",
  "reminders",
];

function normalizeLayout(layout: string[] | undefined | null) {
  const order = new Set<string>();
  if (layout) {
    layout.forEach((key) => {
      if (DEFAULT_LAYOUT.includes(key)) order.add(key);
    });
  }
  DEFAULT_LAYOUT.forEach((key) => order.add(key));
  return Array.from(order);
}

export function useDashboardLayout(restaurantId: number | null) {
  const [layout, setLayout] = React.useState<string[]>(DEFAULT_LAYOUT);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const lastSaved = React.useRef<string[]>(DEFAULT_LAYOUT);
  const hasSameLayout = React.useCallback((nextLayout: string[]) => {
    const normalized = normalizeLayout(nextLayout);
    const current = lastSaved.current;
    if (normalized.length !== current.length) return false;
    return normalized.every((id, index) => id === current[index]);
  }, []);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setLayout(DEFAULT_LAYOUT);
      setIsLoading(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      setIsLoading(true);
      try {
        const data = await fetchDashboardLayout(restaurantId);
        if (!alive) return;
        const normalized = normalizeLayout(data.layout);
        lastSaved.current = normalized;
        setLayout(normalized);
        setLoadError(null);
      } catch (e: any) {
        if (!alive) return;
        setLayout(DEFAULT_LAYOUT);
        setLoadError(e?.friendlyMessage ?? "Не удалось загрузить порядок карточек.");
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const persistLayout = React.useCallback(
    async (nextLayout: string[]) => {
      if (!restaurantId) return { ok: false };
      const normalized = normalizeLayout(nextLayout);
      if (hasSameLayout(normalized)) {
        setLayout(normalized);
        return { ok: true, skipped: true };
      }
      setLayout(normalized);
      try {
        const data = await saveDashboardLayout(restaurantId, normalized);
        const resolved = normalizeLayout(data.layout);
        lastSaved.current = resolved;
        setLayout(resolved);
        return { ok: true };
      } catch (e: any) {
        setLayout(lastSaved.current);
        return { ok: false, message: e?.friendlyMessage };
      }
    },
    [restaurantId, hasSameLayout]
  );

  return {
    layout,
    setLayout,
    isLoading,
    loadError,
    persistLayout,
  };
}

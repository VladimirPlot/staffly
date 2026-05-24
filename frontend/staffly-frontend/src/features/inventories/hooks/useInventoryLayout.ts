import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchInventoryLayout,
  saveInventoryLayout,
  type InventorySectionId,
} from "../api";

export const DEFAULT_INVENTORY_LAYOUT: InventorySectionId[] = ["dishware", "bar", "kitchen"];

function normalizeLayout(layout: InventorySectionId[] | undefined | null): InventorySectionId[] {
  const order = new Set<InventorySectionId>();
  layout?.forEach((key) => {
    if (DEFAULT_INVENTORY_LAYOUT.includes(key)) order.add(key);
  });
  DEFAULT_INVENTORY_LAYOUT.forEach((key) => order.add(key));
  return Array.from(order);
}

export function useInventoryLayout(restaurantId: number | null) {
  const [layout, setLayout] = useState<InventorySectionId[]>(DEFAULT_INVENTORY_LAYOUT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastSaved = useRef<InventorySectionId[]>(DEFAULT_INVENTORY_LAYOUT);

  const hasSameLayout = useCallback((nextLayout: InventorySectionId[]) => {
    const normalized = normalizeLayout(nextLayout);
    const current = lastSaved.current;
    return normalized.length === current.length && normalized.every((id, index) => id === current[index]);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setLayout(DEFAULT_INVENTORY_LAYOUT);
      setIsLoading(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      setIsLoading(true);
      try {
        const data = await fetchInventoryLayout(restaurantId);
        if (!alive) return;
        const normalized = normalizeLayout(data.layout);
        lastSaved.current = normalized;
        setLayout(normalized);
        setLoadError(null);
      } catch (e: any) {
        if (!alive) return;
        setLayout(DEFAULT_INVENTORY_LAYOUT);
        setLoadError(e?.friendlyMessage ?? "Не удалось загрузить порядок разделов.");
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const persistLayout = useCallback(
    async (nextLayout: InventorySectionId[]) => {
      if (!restaurantId) return { ok: false };
      const normalized = normalizeLayout(nextLayout);
      if (hasSameLayout(normalized)) {
        setLayout(normalized);
        return { ok: true, skipped: true };
      }

      setLayout(normalized);
      try {
        const data = await saveInventoryLayout(restaurantId, normalized);
        const resolved = normalizeLayout(data.layout);
        lastSaved.current = resolved;
        setLayout(resolved);
        return { ok: true };
      } catch (e: any) {
        setLayout(lastSaved.current);
        return { ok: false, message: e?.friendlyMessage };
      }
    },
    [hasSameLayout, restaurantId],
  );

  return {
    layout,
    setLayout,
    isLoading,
    loadError,
    persistLayout,
  };
}

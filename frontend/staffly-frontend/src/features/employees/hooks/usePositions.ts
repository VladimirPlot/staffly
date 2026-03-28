import { useCallback, useEffect, useMemo, useState } from "react";
import { listPositions, type PositionDto } from "../../dictionaries/api";

export function usePositions(restaurantId: number | null) {
  const [allPositions, setAllPositions] = useState<PositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const positions = await listPositions(restaurantId, { includeInactive: false });
      setAllPositions(positions);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Не удалось загрузить должности");
      setAllPositions([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activePositions = useMemo(
    () => allPositions.filter((position) => position.active),
    [allPositions]
  );

  return {
    loading,
    error,
    allPositions,
    activePositions,
    refresh,
  };
}

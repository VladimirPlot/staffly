import { useCallback, useEffect, useMemo, useState } from "react";

import { listPositions, type PositionDto } from "../../dictionaries/api";
import { listMembers } from "../../employees/api";
import { listChecklists, type ChecklistDto, type ChecklistKind } from "../api";
import type { ChecklistViewScope } from "../types";
import { sortVisibleChecklists } from "../utils/checklistItems";

type UseChecklistsDataParams = {
  restaurantId: number;
  canManage: boolean;
  currentUserId?: number;
  activeKind: ChecklistKind;
  onListLoaded?: () => void;
};

export function useChecklistsData({
  restaurantId,
  canManage,
  currentUserId,
  activeKind,
  onListLoaded,
}: UseChecklistsDataParams) {
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [checklists, setChecklists] = useState<ChecklistDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<number | null>(null);
  const [myPositionId, setMyPositionId] = useState<number | null>(null);
  const [myPositionLoaded, setMyPositionLoaded] = useState(() => !canManage);
  const [viewScope, setViewScope] = useState<ChecklistViewScope>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const loadPositions = useCallback(async () => {
    try {
      const data = await listPositions(restaurantId, { includeInactive: true });
      setPositions(data);
    } catch (e) {
      console.error("Failed to load positions", e);
    }
  }, [restaurantId]);

  const loadChecklists = useCallback(
    async (signal?: AbortSignal) => {
      if (canManage && !myPositionLoaded) return;
      setLoading(true);
      setError(null);
      try {
        const effectivePositionFilter = canManage ? (viewScope === "my" ? myPositionId : positionFilter) : undefined;
        const data = await listChecklists(
          restaurantId,
          {
            positionId: effectivePositionFilter ?? undefined,
            kind: activeKind,
            q: debouncedQuery,
          },
          signal,
        );
        setChecklists(data);
        onListLoaded?.();
      } catch (e: any) {
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") {
          return;
        }
        console.error("Failed to load checklists", e);
        setError("Не удалось загрузить список");
        setChecklists([]);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [
      activeKind,
      canManage,
      debouncedQuery,
      myPositionId,
      myPositionLoaded,
      onListLoaded,
      positionFilter,
      restaurantId,
      viewScope,
    ],
  );

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    if (!canManage) {
      setMyPositionId(null);
      setViewScope("my");
      setMyPositionLoaded(true);
      return;
    }

    if (!restaurantId || !currentUserId) {
      setMyPositionId(null);
      setViewScope("all");
      setMyPositionLoaded(false);
      return;
    }

    setMyPositionLoaded(false);
    let alive = true;
    const loadMyPosition = async () => {
      try {
        const members = await listMembers(restaurantId);
        if (!alive) return;
        const currentMember = members.find((member) => member.userId === currentUserId);
        const positionId = currentMember?.positionId ?? null;
        setMyPositionId(positionId);
        setViewScope(positionId != null ? "my" : "all");
        setMyPositionLoaded(true);
      } catch (e) {
        console.error("Failed to load current user position", e);
        if (alive) {
          setMyPositionId(null);
          setViewScope("all");
          setMyPositionLoaded(true);
        }
      }
    };
    void loadMyPosition();
    return () => {
      alive = false;
    };
  }, [restaurantId, canManage, currentUserId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
    }, 300);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  useEffect(() => {
    const controller = new AbortController();
    void loadChecklists(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadChecklists]);

  const positionNames = useMemo(() => {
    const map = new Map<number, string>();
    positions.forEach((position) => map.set(position.id, position.name));
    return map;
  }, [positions]);

  const visibleChecklists = useMemo(() => sortVisibleChecklists(checklists, activeKind), [activeKind, checklists]);

  const isListLoading = loading || (canManage && !myPositionLoaded);

  const updateChecklistInState = useCallback((updated: ChecklistDto) => {
    setChecklists((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const handleViewScopeChange = useCallback((scope: ChecklistViewScope) => {
    setViewScope(scope);
    if (scope === "my") {
      setPositionFilter(null);
    }
  }, []);

  const handlePositionFilterChange = useCallback((positionId: number | null) => {
    setPositionFilter(positionId);
    setViewScope("all");
  }, []);

  const resetFilter = useCallback(() => {
    setPositionFilter(null);
    setSearchTerm("");
    setViewScope(myPositionId != null ? "my" : "all");
  }, [myPositionId]);

  return {
    positions,
    checklists,
    visibleChecklists,
    loading,
    error,
    isListLoading,
    positionFilter,
    positionNames,
    myPositionId,
    myPositionLoaded,
    viewScope,
    searchTerm,
    debouncedQuery,
    setSearchTerm,
    loadChecklists,
    updateChecklistInState,
    handleViewScopeChange,
    handlePositionFilterChange,
    resetFilter,
  };
}

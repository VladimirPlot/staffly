import React from "react";

function getStorageKey(restaurantId: number, userId: number) {
  return `restaurant:${restaurantId}:announcementsPreviewHidden:${userId}`;
}

type UseAnnouncementsPreviewVisibilityResult = {
  hidden: boolean;
  hide: () => void;
  show: () => void;
};

export function useAnnouncementsPreviewVisibility(
  restaurantId: number | null,
  userId: number | null
): UseAnnouncementsPreviewVisibilityResult {
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    if (!restaurantId || !userId) {
      setHidden(false);
      return;
    }
    if (typeof window === "undefined") return;
    const key = getStorageKey(restaurantId, userId);
    setHidden(window.localStorage.getItem(key) === "1");
  }, [restaurantId, userId]);

  const hide = React.useCallback(() => {
    if (!restaurantId || !userId) return;
    setHidden(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(getStorageKey(restaurantId, userId), "1");
    }
  }, [restaurantId, userId]);

  const show = React.useCallback(() => {
    if (!restaurantId || !userId) return;
    setHidden(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(getStorageKey(restaurantId, userId));
    }
  }, [restaurantId, userId]);

  return { hidden, hide, show };
}

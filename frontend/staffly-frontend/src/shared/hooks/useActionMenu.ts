import { useCallback, useEffect } from "react";

type MenuId = number | string;

type Params<T extends MenuId> = {
  openId: T | null;
  setOpenId: (value: T | null | ((prev: T | null) => T | null)) => void;
  scope: string;
};

export default function useActionMenu<T extends MenuId>({ openId, setOpenId, scope }: Params<T>) {
  useEffect(() => {
    if (openId == null) return;

    const key = `${scope}:${openId}`;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (
        target.closest(`[data-actions-menu="${key}"]`) ||
        target.closest(`[data-actions-trigger="${key}"]`)
      ) {
        return;
      }

      setOpenId(null);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openId, scope, setOpenId]);

  const getActionsKey = useCallback((id: T) => `${scope}:${id}`, [scope]);

  const toggleMenu = useCallback(
    (id: T) => {
      setOpenId((prev) => (prev === id ? null : id));
    },
    [setOpenId],
  );

  const closeMenu = useCallback(() => {
    setOpenId(null);
  }, [setOpenId]);

  return {
    getActionsKey,
    toggleMenu,
    closeMenu,
  };
}

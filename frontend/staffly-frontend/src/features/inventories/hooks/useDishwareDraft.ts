import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { updateDishwareInventory, type DishwareInventoryDto } from "../api";
import { buildDishwareInventoryItemsPayload } from "../dishwareInventoryItems";
import {
  dishwareDraftError,
  dishwareDraftFingerprint,
  dishwareDraftFromServer,
  emptyDishwareDraft,
  mergeDishwareSavedRows,
  readDishwareDraft,
  type DishwareDraft,
  type StoredDishwareDraft,
} from "../dishwareDraft";
import { getFriendlyInventoryError } from "../inventoryErrors";

export function useDishwareDraft(
  key: string | null,
  restaurantId: number | null,
  inventoryId: number,
  paused: boolean,
) {
  const [draft, setDraftState] = useState(emptyDishwareDraft);
  const current = useRef(draft);
  const [server, setServer] = useState<DishwareInventoryDto | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const baseRef = useRef<string | null>(null);
  const [recovery, setRecovery] = useState<StoredDishwareDraft | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<Promise<DishwareInventoryDto> | null>(null);
  const discarded = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setDraft = useCallback((action: SetStateAction<DishwareDraft>) => {
    const next = typeof action === "function" ? action(current.current) : action;
    current.current = next;
    setDraftState(next);
  }, []);

  const persist = useCallback(
    (value: DishwareDraft, baseline: string | null, reviewRequired = false) => {
      if (!key || baseline === null || discarded.current) return;
      try {
        if (dishwareDraftFingerprint(value) === baseline) localStorage.removeItem(key);
        else
          localStorage.setItem(
            key,
            JSON.stringify({ version: 1, base: baseline, draft: value, needsReview: reviewRequired }),
          );
        setLocalError(null);
      } catch {
        setLocalError("Не удалось сохранить копию на устройстве. Не закрывайте страницу до сохранения на сервере.");
      }
    },
    [key],
  );

  const initialize = useCallback(
    (data: DishwareInventoryDto) => {
      const next = dishwareDraftFromServer(data);
      const fingerprint = dishwareDraftFingerprint(next);
      discarded.current = false;
      setServer(data);
      baseRef.current = fingerprint;
      setBase(fingerprint);
      setRecovery(null);
      setNeedsReview(false);
      setDraft(next);
      if (!key) return;
      try {
        if (data.status === "COMPLETED") {
          localStorage.removeItem(key);
          return;
        }
        const stored = readDishwareDraft(localStorage, key);
        if (!stored) return;
        if (dishwareDraftFingerprint(stored.draft) === fingerprint) {
          localStorage.removeItem(key);
          return;
        }
        if (stored.base === fingerprint) {
          setDraft(stored.draft);
          setNeedsReview(stored.needsReview ?? false);
          setMessage(
            stored.needsReview
              ? "Локальные изменения восстановлены. Проверьте их и нажмите «Сохранить»."
              : "Несохранённые изменения восстановлены с этого устройства.",
          );
        } else {
          // Keep recovery pending until the user chooses: never overwrite a newer server document automatically.
          setRecovery(stored);
        }
      } catch {
        setLocalError("Не удалось прочитать локальную копию документа.");
      }
    },
    [key, setDraft],
  );

  const fingerprint = dishwareDraftFingerprint(draft);
  const dirty = base !== null && fingerprint !== base;
  const validationError = dishwareDraftError(draft);

  useEffect(() => {
    if (server?.status === "DRAFT" && !recovery) persist(draft, base, needsReview);
  }, [base, draft, needsReview, persist, recovery, server?.status]);

  const save = useCallback(async (): Promise<DishwareInventoryDto> => {
    // All manual and automatic saves use the same queue, including rows that receive IDs on first save.
    while (pending.current) await pending.current;
    if (!restaurantId || !server) throw new Error("Инвентаризация не загружена");
    if (server.status !== "DRAFT") throw new Error("Завершённую инвентаризацию нельзя редактировать");
    const snapshot = current.current;
    const problem = dishwareDraftError(snapshot);
    if (problem) throw new Error(problem);
    if (dishwareDraftFingerprint(snapshot) === baseRef.current) return server;
    setBusy(true);
    setSaveError(null);
    const request = updateDishwareInventory(restaurantId, inventoryId, {
      title: snapshot.title,
      inventoryDate: snapshot.inventoryDate,
      comment: snapshot.comment,
      folderId: server.folderId ?? null,
      items: buildDishwareInventoryItemsPayload(snapshot.items),
    });
    pending.current = request;
    try {
      const saved = await request;
      const merged = mergeDishwareSavedRows(current.current, snapshot, saved);
      // Use server-normalized values only if the user has not edited further.
      const next =
        dishwareDraftFingerprint(current.current) === dishwareDraftFingerprint(snapshot)
          ? { ...dishwareDraftFromServer(saved), items: merged.items }
          : merged;
      const savedBase = dishwareDraftFingerprint(dishwareDraftFromServer(saved));
      baseRef.current = savedBase;
      persist(next, savedBase);
      current.current = next;
      if (mounted.current) {
        setServer(saved);
        setBase(savedBase);
        setDraftState(next);
        setMessage(null);
        setNeedsReview(false);
      }
      return saved;
    } finally {
      pending.current = null;
      if (mounted.current) setBusy(false);
    }
  }, [inventoryId, persist, restaurantId, server]);

  useEffect(() => {
    if (!dirty || validationError || paused || recovery || needsReview || server?.status !== "DRAFT") return;
    const timer = window.setTimeout(() => {
      void save().catch((e) => {
        if (mounted.current)
          setSaveError(
            getFriendlyInventoryError(
              e,
              "Не удалось сохранить на сервере. Изменения остаются в локальной копии; повторите сохранение.",
            ),
          );
      });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [dirty, fingerprint, needsReview, paused, recovery, save, server?.status, validationError]);

  useEffect(() => {
    if (!dirty && !busy) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (!recovery) persist(current.current, baseRef.current, needsReview);
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy, dirty, needsReview, persist, recovery]);

  const discard = useCallback(() => {
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Leaving must remain possible if storage is unavailable. */
      }
    }
    discarded.current = true;
  }, [key]);

  const resolveRecovery = (restore: boolean) => {
    if (restore && recovery) {
      setDraft(recovery.draft);
      setNeedsReview(true);
      setMessage("Локальные изменения восстановлены. Проверьте их перед сохранением.");
    } else if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        setLocalError("Не удалось удалить локальную копию.");
      }
    }
    setRecovery(null);
  };

  return {
    draft,
    setDraft,
    initialize,
    save,
    dirty,
    busy,
    validationError,
    saveError,
    localError,
    message,
    recovery,
    resolveRecovery,
    discard,
  };
}

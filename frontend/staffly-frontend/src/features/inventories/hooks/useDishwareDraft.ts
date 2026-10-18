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
  type PendingDishwareSave,
} from "../dishwareDraft";
import {
  alignDishwareDraftKeys,
  getDishwareConflictCurrent,
  resolveDishwareConflict,
  type DishwareConflict,
  type DishwareResolution,
} from "../dishwareConflict";
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
  const serverRef = useRef<DishwareInventoryDto | null>(null);
  const baseDraft = useRef<DishwareDraft | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const baseRef = useRef<string | null>(null);
  const [recovery, setRecovery] = useState<StoredDishwareDraft | null>(null);
  const [conflict, setConflict] = useState<DishwareConflict | null>(null);
  const conflictRef = useRef<DishwareConflict | null>(null);
  const dismissedConflict = useRef<DishwareConflict | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef<Promise<DishwareInventoryDto> | null>(null);
  const pendingSave = useRef<PendingDishwareSave | null>(null);
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
  const updateConflict = useCallback((value: DishwareConflict | null) => {
    conflictRef.current = value;
    setConflict(value);
  }, []);
  const persist = useCallback(
    (value: DishwareDraft, baseline: string | null, reviewRequired = false) => {
      if (!key || baseline === null || discarded.current) return;
      try {
        if (dishwareDraftFingerprint(value) === baseline && !pendingSave.current) localStorage.removeItem(key);
        else
          localStorage.setItem(
            key,
            JSON.stringify({
              version: 1,
              base: baseline,
              draft: value,
              needsReview: reviewRequired,
              baseDraft: baseDraft.current,
              pendingSave: pendingSave.current ?? undefined,
            }),
          );
        if (mounted.current) setLocalError(null);
      } catch {
        if (mounted.current)
          setLocalError("Не удалось сохранить копию на устройстве. Не закрывайте страницу до сохранения на сервере.");
      }
    },
    [key],
  );

  const initialize = useCallback(
    (data: DishwareInventoryDto) => {
      const next = dishwareDraftFromServer(data),
        fingerprint = dishwareDraftFingerprint(next);
      discarded.current = false;
      serverRef.current = data;
      setServer(data);
      baseDraft.current = next;
      baseRef.current = fingerprint;
      setBase(fingerprint);
      pendingSave.current = null;
      dismissedConflict.current = null;
      updateConflict(null);
      setRecovery(null);
      setNeedsReview(false);
      setSaveError(null);
      setMessage(null);
      setDraft(next);
      if (!key) return;
      try {
        const stored = readDishwareDraft(localStorage, key);
        if (!stored) return;
        const local = alignDishwareDraftKeys(stored.draft, data);
        if (stored.pendingSave) {
          pendingSave.current = stored.pendingSave;
          baseDraft.current = stored.baseDraft ?? stored.pendingSave.base;
          baseRef.current = stored.base;
          setBase(stored.base);
          setDraft(local);
          setNeedsReview(true);
          updateConflict({ base: baseDraft.current, local, current: data });
          setMessage("Сохранение было прервано. Повторная попытка проверит, принял ли сервер предыдущий запрос.");
          return;
        }
        if (dishwareDraftFingerprint(local) === fingerprint) {
          localStorage.removeItem(key);
          return;
        }
        if (data.status !== "DRAFT") {
          setDraft(local);
          updateConflict({ base: stored.baseDraft ?? null, local, current: data });
          return;
        }
        if (stored.base === fingerprint) {
          setDraft(local);
          setNeedsReview(stored.needsReview ?? false);
          setMessage(
            stored.needsReview
              ? "Локальные изменения восстановлены. Проверьте их и нажмите «Сохранить»."
              : "Несохранённые изменения восстановлены с этого устройства.",
          );
        } else setRecovery({ ...stored, draft: local });
      } catch {
        setLocalError("Не удалось прочитать локальную копию документа.");
      }
    },
    [key, setDraft, updateConflict],
  );

  const fingerprint = dishwareDraftFingerprint(draft);
  const dirty = base !== null && (fingerprint !== base || Boolean(pendingSave.current));
  const validationError = dishwareDraftError(draft);
  useEffect(() => {
    if (server && !recovery) persist(draft, base, needsReview || Boolean(conflict));
  }, [base, conflict, draft, needsReview, persist, recovery, server]);

  const captureConflict = useCallback(
    (error: unknown) => {
      const latest = getDishwareConflictCurrent(error);
      if (!latest || latest.id !== inventoryId || latest.restaurantId !== restaurantId) return false;
      updateConflict({ base: baseDraft.current, local: current.current, current: latest });
      setSaveError(null);
      return true;
    },
    [inventoryId, restaurantId, updateConflict],
  );

  const send = useCallback(
    async (operation: PendingDishwareSave): Promise<DishwareInventoryDto> => {
      if (!restaurantId) throw new Error("Инвентаризация не загружена");
      pendingSave.current = operation;
      persist(current.current, baseRef.current, true);
      setBusy(true);
      setSaveError(null);
      try {
        const saved = await updateDishwareInventory(restaurantId, inventoryId, {
          expectedVersion: operation.expectedVersion,
          requestId: operation.requestId,
          title: operation.snapshot.title,
          inventoryDate: operation.snapshot.inventoryDate,
          comment: operation.snapshot.comment,
          folderId: operation.folderId,
          items: buildDishwareInventoryItemsPayload(operation.snapshot.items),
        });
        const merged = mergeDishwareSavedRows(current.current, operation.snapshot, saved);
        const next =
          dishwareDraftFingerprint(current.current) === dishwareDraftFingerprint(operation.input)
            ? {
                ...dishwareDraftFromServer(saved),
                items: mergeDishwareSavedRows(operation.snapshot, operation.snapshot, saved).items,
              }
            : merged;
        pendingSave.current = null;
        dismissedConflict.current = null;
        serverRef.current = saved;
        baseDraft.current = dishwareDraftFromServer(saved);
        baseRef.current = dishwareDraftFingerprint(baseDraft.current);
        current.current = next;
        persist(next, baseRef.current);
        if (mounted.current) {
          setServer(saved);
          setBase(baseRef.current);
          setDraftState(next);
          setMessage(null);
          setNeedsReview(false);
          updateConflict(null);
        }
        return saved;
      } catch (error) {
        const latest = getDishwareConflictCurrent(error);
        if (latest && latest.id === inventoryId && latest.restaurantId === restaurantId) {
          const meta = (
            error as { response: { data: { meta: { alreadyApplied?: boolean; appliedVersion?: number } } } }
          ).response.data.meta;
          let local = current.current;
          if (meta.alreadyApplied) {
            if (dishwareDraftFingerprint(local) === dishwareDraftFingerprint(operation.input)) {
              local = operation.snapshot;
              setDraft(local);
            }
            baseDraft.current = operation.snapshot;
            baseRef.current = dishwareDraftFingerprint(operation.snapshot);
            setBase(baseRef.current);
            if (serverRef.current && meta.appliedVersion !== undefined)
              serverRef.current = { ...serverRef.current, version: meta.appliedVersion };
          }
          pendingSave.current = null;
          updateConflict({ base: meta.alreadyApplied ? operation.snapshot : operation.base, local, current: latest });
          setMessage(
            meta.alreadyApplied
              ? "Ваше сохранение уже принято. Ниже показаны последующие изменения другого менеджера."
              : null,
          );
          persist(local, baseRef.current, true);
        } else {
          const status = (error as { response?: { status?: number } })?.response?.status;
          // Definitive rejections were not committed; a corrected draft needs a new operation ID.
          if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
            pendingSave.current = null;
            persist(current.current, baseRef.current, Boolean(conflictRef.current));
          }
        }
        throw error;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [inventoryId, persist, restaurantId, setDraft, updateConflict],
  );

  const enqueue = useCallback(
    async (operation: PendingDishwareSave) => {
      while (inFlight.current) await inFlight.current;
      const task = send(operation);
      inFlight.current = task;
      try {
        return await task;
      } finally {
        inFlight.current = null;
      }
    },
    [send],
  );

  const save = useCallback(async (): Promise<DishwareInventoryDto> => {
    while (inFlight.current) await inFlight.current;
    if (pendingSave.current) await enqueue(pendingSave.current);
    if (dismissedConflict.current) {
      updateConflict({ ...dismissedConflict.current, local: current.current });
      dismissedConflict.current = null;
      throw new Error("Выберите способ объединения результатов");
    }
    if (conflictRef.current) throw new Error("Выберите способ объединения результатов");
    const loaded = serverRef.current;
    if (!loaded) throw new Error("Инвентаризация не загружена");
    if (loaded.status !== "DRAFT") throw new Error("Завершённую инвентаризацию нельзя редактировать");
    const snapshot = current.current,
      problem = dishwareDraftError(snapshot);
    if (problem) throw new Error(problem);
    if (dishwareDraftFingerprint(snapshot) === baseRef.current) return loaded;
    return enqueue({
      requestId: crypto.randomUUID(),
      expectedVersion: loaded.version,
      folderId: loaded.folderId ?? null,
      snapshot,
      input: snapshot,
      base: baseDraft.current,
    });
  }, [enqueue, updateConflict]);

  const resolveConflict = async (mode: DishwareResolution) => {
    try {
      if (pendingSave.current) return await enqueue(pendingSave.current);
      const selected = conflictRef.current;
      if (!selected) return;
      if (selected.current.status !== "DRAFT")
        throw new Error("Документ завершён. Для изменения сначала верните актуальную версию в черновик.");
      const snapshot = resolveDishwareConflict(selected, mode),
        problem = dishwareDraftError(snapshot);
      if (problem) throw new Error(problem);
      return await enqueue({
        requestId: crypto.randomUUID(),
        expectedVersion: selected.current.version,
        folderId: selected.current.folderId ?? null,
        snapshot,
        input: current.current,
        base: selected.base,
      });
    } catch (error) {
      setSaveError(
        getFriendlyInventoryError(error, error instanceof Error ? error.message : "Не удалось сохранить результаты"),
      );
    }
  };

  useEffect(() => {
    if (!dirty || validationError || paused || recovery || conflict || needsReview || server?.status !== "DRAFT")
      return;
    const timer = window.setTimeout(() => {
      void save().catch((error) => {
        if (mounted.current && !conflictRef.current)
          setSaveError(
            getFriendlyInventoryError(
              error,
              "Не удалось сохранить на сервере. Изменения остаются в локальной копии; повторите сохранение.",
            ),
          );
      });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [conflict, dirty, fingerprint, needsReview, paused, recovery, save, server?.status, validationError]);

  useEffect(() => {
    if (!dirty && !busy && !conflict && !recovery) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (!recovery) persist(current.current, baseRef.current, needsReview || Boolean(conflict));
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy, conflict, dirty, needsReview, persist, recovery]);

  const discard = useCallback(() => {
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Leaving remains possible without local storage. */
      }
    }
    discarded.current = true;
  }, [key]);

  const resolveRecovery = (restore: boolean) => {
    if (restore && recovery && serverRef.current) {
      baseDraft.current = recovery.baseDraft ?? null;
      baseRef.current = recovery.base;
      setBase(recovery.base);
      setDraft(recovery.draft);
      setNeedsReview(true);
      updateConflict({ base: recovery.baseDraft ?? null, local: recovery.draft, current: serverRef.current });
    } else if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        setLocalError("Не удалось удалить локальную копию.");
      }
    }
    setRecovery(null);
  };
  const cancelConflict = () => {
    dismissedConflict.current = conflictRef.current;
    updateConflict(null);
    setNeedsReview(true);
    setSaveError(null);
    setMessage(
      "Автосохранение приостановлено. Ваши данные сохранены на устройстве. Нажмите «Сохранить», чтобы вернуться к объединению.",
    );
  };
  const adoptPhoto = (updated: DishwareInventoryDto, itemId: number) => {
    serverRef.current = updated;
    setServer(updated);
    baseDraft.current = dishwareDraftFromServer(updated);
    baseRef.current = dishwareDraftFingerprint(baseDraft.current);
    setBase(baseRef.current);
    const photo = updated.items.find((row) => row.id === itemId)?.photoUrl ?? null;
    setDraft((previous) => ({
      ...previous,
      items: previous.items.map((row) => (row.id === itemId ? { ...row, photoUrl: photo } : row)),
    }));
  };
  const acceptCurrent = () => {
    const latest = conflictRef.current?.current;
    if (latest) {
      discard();
      initialize(latest);
    }
  };
  return {
    draft,
    setDraft,
    server,
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
    conflict,
    captureConflict,
    resolveConflict,
    cancelConflict,
    adoptPhoto,
    acceptCurrent,
    hasPendingSave: Boolean(pendingSave.current),
  };
}

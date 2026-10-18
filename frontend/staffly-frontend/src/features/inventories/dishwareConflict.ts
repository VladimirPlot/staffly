import type { DishwareInventoryDto } from "./api";
import { dishwareDraftFromServer, type DishwareDraft } from "./dishwareDraft.ts";
import type { DishwareInventoryEditableItem as Item } from "./dishwareInventoryItems";
import { parseDishwareCountInput, parseDishwareMoneyInput } from "./utils.ts";

export type DishwareConflict = { base: DishwareDraft | null; local: DishwareDraft; current: DishwareInventoryDto };
export type DishwareResolution = "overwrite" | "sum";
const fields = ["name", "previousQty", "incomingQty", "currentQty", "unitPrice", "note"] as const;
type Field = (typeof fields)[number];
export const dishwareFieldLabels: Record<Field, string> = {
  name: "Название",
  previousQty: "Было",
  incomingQty: "Приход",
  currentQty: "Стало",
  unitPrice: "Цена",
  note: "Заметка",
};

function value(item: Item, field: Field): string | number | null {
  const raw = item[field];
  try {
    if (field.endsWith("Qty")) return parseDishwareCountInput(String(raw ?? 0));
    if (field === "unitPrice") return parseDishwareMoneyInput(String(raw ?? ""));
  } catch {
    return String(raw);
  }
  return String(raw ?? "").trim();
}

function changed(a: Item, b: Item) {
  return Boolean(b.pendingPhoto || b.removePhoto) || fields.some((field) => value(a, field) !== value(b, field));
}

export function alignDishwareDraftKeys(draft: DishwareDraft, current: DishwareInventoryDto): DishwareDraft {
  const keys = new Map(current.items.map((row) => [row.id, row.clientKey ?? String(row.id)]));
  return {
    ...draft,
    items: draft.items.map((row) => ({
      ...row,
      clientId: row.id != null ? (keys.get(row.id) ?? row.clientId) : row.clientId,
    })),
  };
}

function joinNotes(local: string | null | undefined, remote: string | null | undefined) {
  return [local?.trim(), remote?.trim()].filter(Boolean).join("\n\n");
}

/** Three-way merge: only an explicit sum doubles independently changed counted quantities. */
export function resolveDishwareConflict(conflict: DishwareConflict, mode: DishwareResolution): DishwareDraft {
  const remote = dishwareDraftFromServer(conflict.current);
  const local = alignDishwareDraftKeys(conflict.local, conflict.current);
  const base = conflict.base ? alignDishwareDraftKeys(conflict.base, conflict.current) : null;
  const remoteRows = new Map(remote.items.map((row) => [row.clientId, row]));
  if (!base) {
    if (mode === "sum")
      throw new Error("Для сложения нужна исходная версия документа. Выберите перезапись или отмену.");
    return {
      ...local,
      items: local.items.map((row) => {
        const live = remoteRows.get(row.clientId);
        return { ...row, id: live?.id, photoUrl: live?.photoUrl ?? null };
      }),
    };
  }
  const baseRows = new Map(base.items.map((row) => [row.clientId, row]));
  const localRows = new Map(local.items.map((row) => [row.clientId, row]));
  const keys = new Set([...remote.items.map((row) => row.clientId), ...local.items.map((row) => row.clientId)]);
  const items: Item[] = [];
  for (const key of keys) {
    const before = baseRows.get(key),
      ours = localRows.get(key),
      theirs = remoteRows.get(key);
    if (!ours && theirs) {
      // Keep remote additions. In sum mode preserve their edits against our deletion.
      if (!before || (mode === "sum" && changed(before, theirs))) items.push(theirs);
      continue;
    }
    if (ours && !theirs) {
      // An unchanged row deleted remotely stays deleted; edited rows are explicitly recreated.
      if (!before || changed(before, ours)) items.push({ ...ours, id: undefined, photoUrl: null });
      continue;
    }
    if (!ours || !theirs) continue;
    const row: Item = { ...theirs, pendingPhoto: ours.pendingPhoto, removePhoto: ours.removePhoto };
    for (const field of fields) {
      const oursChanged = !before || value(ours, field) !== value(before, field);
      const theirsChanged = !before || value(theirs, field) !== value(before, field);
      if (!oursChanged) continue;
      if (mode === "sum" && before && field === "currentQty" && theirsChanged) {
        row.currentQty =
          parseDishwareCountInput(String(ours.currentQty)) + parseDishwareCountInput(String(theirs.currentQty));
      } else if (
        mode === "sum" &&
        before &&
        field === "note" &&
        theirsChanged &&
        value(ours, field) !== value(theirs, field)
      ) {
        row.note = joinNotes(ours.note, theirs.note);
      } else {
        Object.assign(row, { [field]: ours[field] });
      }
    }
    items.push(row);
  }
  const result: DishwareDraft = { ...remote, items: items.map((row, sortOrder) => ({ ...row, sortOrder })) };
  for (const field of ["title", "inventoryDate", "comment"] as const) {
    if (local[field] === base[field]) continue;
    result[field] =
      mode === "sum" && field === "comment" && remote[field] !== base[field] && local[field] !== remote[field]
        ? joinNotes(local[field], remote[field])
        : local[field];
  }
  if (Boolean(local.includeSurplus) !== Boolean(base.includeSurplus))
    result.includeSurplus = Boolean(local.includeSurplus);
  return result;
}

export function summarizeDishwareConflict(conflict: DishwareConflict) {
  const remote = dishwareDraftFromServer(conflict.current);
  const local = alignDishwareDraftKeys(conflict.local, conflict.current);
  const base = conflict.base ? alignDishwareDraftKeys(conflict.base, conflict.current) : null;
  const originals = new Map(base?.items.map((row) => [row.clientId, row]) ?? []);
  const ours = new Map(local.items.map((row) => [row.clientId, row]));
  const theirs = new Map(remote.items.map((row) => [row.clientId, row]));
  const keys = new Set([...originals.keys(), ...ours.keys(), ...theirs.keys()]);
  const rows: Array<{ key: string; name: string; details: string[] }> = [];
  for (const key of keys) {
    const before = originals.get(key),
      a = ours.get(key),
      b = theirs.get(key);
    const details: string[] = [];
    if (a?.pendingPhoto) details.push("У вас выбрано новое фото; оно будет загружено после сведения результатов");
    if (a?.removePhoto) details.push("Вы удаляете фото позиции");
    if (before && !a) details.push("Вы удалили позицию");
    if (before && !b)
      details.push(
        a && changed(before, a)
          ? "Другой менеджер удалил позицию; ваши изменения восстановят её без удалённого фото"
          : "Другой менеджер удалил позицию",
      );
    if (!before && a) details.push("Ваша новая позиция");
    if (!before && b) details.push("Новая позиция на сервере");
    if (a && b)
      for (const field of fields) {
        if (
          value(a, field) === value(b, field) &&
          !(field === "currentQty" && before && value(a, field) !== value(before, field))
        )
          continue;
        const format = (row: Item) => String(value(row, field) ?? "не указано");
        details.push(`${dishwareFieldLabels[field]}: на сервере «${format(b)}», у вас «${format(a)}»`);
      }
    if (details.length) rows.push({ key, name: a?.name || b?.name || before?.name || "Позиция", details });
  }
  const metadata = (["title", "inventoryDate", "comment", "includeSurplus"] as const)
    .filter((field) =>
      field === "includeSurplus" ? Boolean(local[field]) !== Boolean(remote[field]) : local[field] !== remote[field],
    )
    .map((field) => ({
      field,
      local: field === "includeSurplus" ? (local[field] ? "Включён" : "Выключен") : local[field],
      remote: field === "includeSurplus" ? (remote[field] ? "Включён" : "Выключен") : remote[field],
    }));
  return { rows, metadata };
}

export function getDishwareConflictCurrent(error: unknown): DishwareInventoryDto | null {
  const response = (
    error as { response?: { status?: number; data?: { meta?: { type?: string; current?: DishwareInventoryDto } } } }
  )?.response;
  const current = response?.data?.meta?.current;
  return response?.status === 409 &&
    response.data?.meta?.type === "DISHWARE_VERSION_CONFLICT" &&
    current &&
    Number.isSafeInteger(current.version) &&
    Array.isArray(current.items)
    ? current
    : null;
}

import type { DishwareInventoryDto } from "./api";

const display = (value: unknown): string => (value == null || value === "" ? "—" : String(value));

export function dishwareHistoryChanges(
  before: DishwareInventoryDto | null,
  after: DishwareInventoryDto | null,
): string[] {
  if (!before || !after) return [];
  const changes: string[] = [];
  const fields = {
    title: "Название",
    inventoryDate: "Дата",
    comment: "Комментарий",
    status: "Статус",
    includeSurplus: "Учёт излишков",
  } as const;
  const format = (field: keyof typeof fields, inventory: DishwareInventoryDto) =>
    field === "includeSurplus"
      ? inventory.includeSurplus
        ? "включён"
        : "выключен"
      : field === "status"
        ? inventory.status === "COMPLETED"
          ? "Завершена"
          : "Черновик"
        : display(inventory[field]);
  for (const field of Object.keys(fields) as Array<keyof typeof fields>) {
    if (format(field, before) !== format(field, after))
      changes.push(`${fields[field]}: ${format(field, before)} → ${format(field, after)}`);
  }
  if (before.folderId !== after.folderId)
    changes.push(after.folderId == null ? "Документ перемещён в корень" : "Документ перемещён в другую папку");
  const rowKey = (row: DishwareInventoryDto["items"][number]) => row.clientKey ?? String(row.id);
  const oldRows = new Map(before.items.map((row) => [rowKey(row), row]));
  const newRows = new Map(after.items.map((row) => [rowKey(row), row]));
  const rowFields = {
    name: "Название",
    previousQty: "Было",
    incomingQty: "Приход",
    currentQty: "Стало",
    unitPrice: "Цена",
    note: "Заметка",
    sortOrder: "Порядок",
  } as const;
  const describe = (row: DishwareInventoryDto["items"][number]) =>
    `${row.name} (Было: ${row.previousQty}, приход: ${row.incomingQty ?? 0}, Стало: ${row.currentQty}, цена: ${display(row.unitPrice)}, заметка: ${display(row.note)})`;
  for (const [key, row] of oldRows) {
    const next = newRows.get(key);
    if (!next) {
      changes.push(`Удалена позиция: ${describe(row)}`);
      continue;
    }
    for (const field of Object.keys(rowFields) as Array<keyof typeof rowFields>) {
      if (display(row[field]) !== display(next[field]))
        changes.push(`${row.name} · ${rowFields[field]}: ${display(row[field])} → ${display(next[field])}`);
    }
    if (row.photoUrl !== next.photoUrl)
      changes.push(
        `${row.name} · фото: ${row.photoUrl ? "было" : "отсутствовало"} → ${next.photoUrl ? "добавлено/заменено" : "удалено"}`,
      );
  }
  for (const [key, row] of newRows) if (!oldRows.has(key)) changes.push(`Добавлена позиция: ${describe(row)}`);
  return changes;
}

import { useEffect, useRef, useState } from "react";
import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import { getDishwareInventoryHistory, type DishwareInventoryHistoryDto } from "../api";
import { dishwareHistoryChanges } from "../dishwareHistory";
import { getFriendlyInventoryError } from "../inventoryErrors";

const actions: Record<string, string> = {
  CREATED: "Создана",
  UPDATED: "Изменены данные",
  COMPLETED: "Завершена и зафиксирована",
  REOPENED: "Открыта для исправления",
  PHOTO_UPLOADED: "Добавлено или заменено фото",
  PHOTO_DELETED: "Удалено фото",
  MOVED: "Перемещена",
  TRASHED: "Перемещена в корзину",
  RESTORED: "Восстановлена",
  DELETED: "Удалена навсегда",
};

export default function DishwareHistoryModal({
  restaurantId,
  inventoryId,
  onClose,
}: {
  restaurantId: number;
  inventoryId: number;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<DishwareInventoryHistoryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const active = useRef(true);
  async function load(beforeId?: number) {
    setLoading(true);
    setError(null);
    try {
      const page = await getDishwareInventoryHistory(restaurantId, inventoryId, beforeId);
      if (!active.current) return;
      setEntries((previous) => (beforeId ? [...previous, ...page] : page));
      setMore(page.length === 30);
    } catch (err) {
      if (active.current) setError(getFriendlyInventoryError(err, "Не удалось загрузить историю изменений"));
    } finally {
      if (active.current) setLoading(false);
    }
  }
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
    };
    // The editor remounts this dialog for each document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Modal
      open
      title="История изменений"
      className="max-w-3xl"
      onClose={onClose}
      footer={
        <Button variant="outline" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-muted text-xs">
          История ведётся с момента включения этой функции. Более ранние изменения в ней отсутствуют.
        </p>
        {entries.map((entry) => (
          <details
            key={entry.id}
            className="border-subtle rounded-xl border p-3 break-words"
            onToggle={(event) => {
              const open = event.currentTarget.open;
              setExpanded((previous) => {
                const next = new Set(previous);
                if (open) next.add(entry.id);
                else next.delete(entry.id);
                return next;
              });
            }}
          >
            <summary className="cursor-pointer text-sm">
              <span className="font-medium">{actions[entry.action] ?? entry.action}</span>
              <span className="text-muted block text-xs">
                {new Date(entry.occurredAt).toLocaleString("ru-RU")} · {entry.actorName}
              </span>
            </summary>
            {entry.reason && <p className="mt-2 text-sm break-words whitespace-pre-wrap">Причина: {entry.reason}</p>}
            <ul className="mt-2 space-y-1 text-sm">
              {expanded.has(entry.id) &&
                dishwareHistoryChanges(entry.before, entry.after).map((change, index) => (
                  <li key={index} className="break-words whitespace-pre-wrap">
                    {change}
                  </li>
                ))}
            </ul>
            {entry.action === "CREATED" && (
              <p className="mt-2 text-sm">
                {entry.after?.sourceInventoryTitle
                  ? `На основе: ${entry.after.sourceInventoryTitle}`
                  : "Инвентаризация с нуля"}
              </p>
            )}
          </details>
        ))}
        {!loading && !entries.length && !error && <p className="text-muted text-sm">Записей об изменениях пока нет.</p>}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status" className="text-muted text-sm">
            Загружаем историю…
          </p>
        ) : (
          (more || error) && (
            <Button variant="outline" onClick={() => void load(entries.at(-1)?.id)}>
              {error ? "Повторить загрузку" : "Показать ещё"}
            </Button>
          )
        )}
      </div>
    </Modal>
  );
}

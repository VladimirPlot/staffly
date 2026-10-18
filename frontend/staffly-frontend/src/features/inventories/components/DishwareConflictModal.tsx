import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import { dishwareDraftError } from "../dishwareDraft";
import {
  resolveDishwareConflict,
  summarizeDishwareConflict,
  type DishwareConflict,
  type DishwareResolution,
} from "../dishwareConflict";

type Props = {
  conflict: DishwareConflict | null;
  busy: boolean;
  error: string | null;
  pending: boolean;
  onResolve: (mode: DishwareResolution) => void;
  onCancel: () => void;
  onAcceptCurrent: () => void;
};

export default function DishwareConflictModal({
  conflict,
  busy,
  error,
  pending,
  onResolve,
  onCancel,
  onAcceptCurrent,
}: Props) {
  if (!conflict) return null;
  const summary = summarizeDishwareConflict(conflict);
  const problems = (mode: DishwareResolution) => {
    try {
      return dishwareDraftError(resolveDishwareConflict(conflict, mode));
    } catch (e) {
      return (e as Error).message;
    }
  };
  const sumProblem = problems("sum"),
    overwriteProblem = problems("overwrite");
  const active = conflict.current.status === "DRAFT";
  return (
    <Modal
      open
      title="Инвентаризация изменилась"
      onClose={() => {
        if (!busy) onCancel();
      }}
      className="max-w-3xl"
      description="Другой менеджер сохранил изменения. Ваши данные сохранены на устройстве. Выберите, как свести результаты."
      footer={
        <div className="flex flex-col gap-2">
          {pending ? (
            <Button disabled={busy} isLoading={busy} onClick={() => onResolve("overwrite")}>
              Повторить сохранение
            </Button>
          ) : active ? (
            <>
              <Button
                disabled={busy || Boolean(overwriteProblem)}
                isLoading={busy}
                onClick={() => onResolve("overwrite")}
              >
                Перезаписать результаты
              </Button>
              <Button variant="outline" disabled={busy || Boolean(sumProblem)} onClick={() => onResolve("sum")}>
                Сложить результаты
              </Button>
            </>
          ) : (
            <Button disabled={busy} onClick={onAcceptCurrent}>
              Использовать актуальный завершённый документ
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Отмена
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        {!active ? (
          <p>
            Другой менеджер завершил документ. Изменения в завершённый документ внести нельзя. При выборе актуального
            документа локальные правки будут отброшены.
          </p>
        ) : (
          <>
            <p>
              Изменения разных позиций объединяются в обоих вариантах. «Перезаписать» применяет ваши правки при
              разногласиях, включая удаление изменённой другим менеджером строки.
            </p>
            <p>
              «Сложить» суммирует «Стало» только там, где его изменили оба менеджера, и сохраняет изменённые строки при
              конфликте с удалением. «Было», приход и цена не складываются: при разногласиях используются ваши значения.
              Разные заметки и комментарии объединяются.
            </p>
          </>
        )}
        {pending ? (
          <p role="status">
            Ответ на предыдущее сохранение не получен. Повторная попытка проверит его результат и не прибавит ваши
            значения второй раз.
          </p>
        ) : null}
        <div className="border-subtle max-h-72 space-y-3 overflow-auto rounded-xl border p-3">
          {summary.rows.map((row) => (
            <div key={row.key}>
              <div className="font-medium break-words">{row.name}</div>
              <ul className="text-muted list-inside list-disc">
                {row.details.map((detail, i) => (
                  <li className="break-words" key={i}>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {summary.metadata.map((change) => (
            <div key={change.field} className="break-words">
              <span className="font-medium">
                {
                  {
                    title: "Название документа",
                    inventoryDate: "Дата",
                    comment: "Комментарий",
                    includeSurplus: "Учёт излишков",
                  }[change.field]
                }
                :
              </span>
              <div>На сервере: {change.remote || "не указано"}</div>
              <div>У вас: {change.local || "не указано"}</div>
            </div>
          ))}
          {!summary.rows.length && !summary.metadata.length ? (
            <p>Изменены фото, расположение или состояние документа. Количества совпадают.</p>
          ) : null}
        </div>
        {active && sumProblem && !pending ? (
          <p className="text-red-600">Сложение недоступно: {sumProblem}. Нажмите «Отмена», чтобы исправить данные.</p>
        ) : null}
        {active && overwriteProblem && !pending ? (
          <p className="text-red-600">Перезапись недоступна: {overwriteProblem}.</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

import type { TaskAudienceAction, TaskOpportunity } from "../api";
import { formatTaskInstant } from "../utils";
export default function TaskAudienceChoices({
  items,
  values,
  onChange,
  timezone,
  disabled = false,
}: {
  items: TaskOpportunity[];
  values: Record<number, TaskAudienceAction>;
  onChange: (id: number, value: TaskAudienceAction) => void;
  timezone: string;
  disabled?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">Участие в задачах</h3>
      {items.map((t) => (
        <div key={t.taskId} className="border-subtle rounded-xl border p-3 text-sm">
          <p className="font-medium">{t.title}</p>
          {t.leaving ? (
            <p className="text-muted mt-1">
              Сотрудник перестанет участвовать. Прежнее выполнение сохранится в истории.
            </p>
          ) : t.completionMode === "ANY" ? (
            <p className="text-muted mt-1">Подключится автоматически. Достаточно одного исполнителя.</p>
          ) : (
            <>
              <p className="text-muted mt-1">
                Сейчас выполнили {t.completedCount} из {t.participantCount}. При добавлении состав увеличится на одного.
              </p>
              {t.previousCompletedAt && (
                <p className="mt-1 text-emerald-600">
                  Ранее выполнено: {formatTaskInstant(t.previousCompletedAt, timezone)}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-3">
                {(["ADD", "SKIP", ...(t.previousCompletedAt ? ["RESTORE"] : [])] as TaskAudienceAction[]).map((a) => (
                  <label key={a} className="flex gap-2">
                    <input
                      type="radio"
                      name={"task-choice-" + t.taskId}
                      checked={values[t.taskId] === a}
                      onChange={() => onChange(t.taskId, a)}
                      disabled={disabled}
                    />
                    {a === "ADD" ? "Назначить выполнение" : a === "SKIP" ? "Не добавлять" : "Зачесть прежний результат"}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

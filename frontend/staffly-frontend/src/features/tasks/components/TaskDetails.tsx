import { useEffect, useState } from "react";
import { Check, MessageSquare, MoreHorizontal } from "lucide-react";
import Modal from "../../../shared/ui/Modal";
import Button from "../../../shared/ui/Button";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import { createTaskComment, listTaskComments, type TaskDto, type TaskCommentPageDto } from "../api";
import { formatTaskDate, formatTaskInstant, priorityLabels } from "../utils";

type Props = {
  task: TaskDto;
  canManage: boolean;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onComplete: () => void;
  onUndo: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReopen: () => void;
};
export default function TaskDetails({
  task,
  canManage,
  busy,
  error: actionError,
  onClose,
  onComplete,
  onUndo,
  onEdit,
  onDelete,
  onReopen,
}: Props) {
  const [page, setPage] = useState<TaskCommentPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setPage(null);
    setLoading(true);
    setError(null);
    setText("");
    listTaskComments(task.id, { page: 0, size: 20 })
      .then((p) => {
        if (alive) setPage(p);
      })
      .catch(() => {
        if (alive) setError("Не удалось загрузить комментарии.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [task.id, revision]);
  async function more() {
    if (!page || !page.hasNext || loading) return;
    setLoading(true);
    try {
      const next = await listTaskComments(task.id, { page: page.page + 1, size: 20 });
      setPage((prev) => (prev ? { ...next, items: [...prev.items, ...next.items] } : next));
    } catch {
      setError("Не удалось загрузить следующие комментарии.");
    } finally {
      setLoading(false);
    }
  }
  async function send() {
    if (!text.trim() || sending || !page) return;
    setSending(true);
    setError(null);
    try {
      await createTaskComment(task.id, { text: text.trim() });
      // Reload after sending: appending to a partial page would break chronological order.
      setText("");
      const fresh = await listTaskComments(task.id, { page: 0, size: Math.max(page.items.length + 1, 20) });
      setPage(fresh);
    } catch {
      setError("Не удалось отправить или обновить комментарий. Проверьте ленту перед повторной отправкой.");
    } finally {
      setSending(false);
    }
  }
  const done = task.status === "COMPLETED";
  return (
    <Modal
      open
      title={task.title}
      headerCloseButton
      placement="right"
      onClose={onClose}
      className="max-w-2xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {canManage && (
            <DropdownMenu
              trigger={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  aria-label="Действия с задачей"
                  disabled={busy}
                  leftIcon={<MoreHorizontal size={18} />}
                >
                  Действия
                </Button>
              )}
            >
              {({ close }) => (
                <div className="p-1">
                  {!done ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        close();
                        onEdit();
                      }}
                    >
                      Редактировать
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        close();
                        onReopen();
                      }}
                    >
                      Вернуть в работу
                    </Button>
                  )}
                  <Button
                    variant="danger-ghost"
                    onClick={() => {
                      close();
                      onDelete();
                    }}
                  >
                    Удалить задачу
                  </Button>
                </div>
              )}
            </DropdownMenu>
          )}
          {task.completionMode === "EACH" && task.myCompleted ? (
            <Button variant="outline" disabled={busy} onClick={onUndo}>
              Отменить мою отметку
            </Button>
          ) : !done && task.canComplete ? (
            <Button disabled={busy} onClick={onComplete} leftIcon={<Check size={16} />}>
              {task.completionMode === "EACH" ? "Отметить своё выполнение" : "Завершить задачу"}
            </Button>
          ) : (
            <span className="text-muted text-sm">{done ? "Задача завершена" : "Ожидаем исполнителей"}</span>
          )}
        </div>
      }
    >
      <div className="space-y-6 p-2 sm:p-0">
        {actionError && (
          <p role="alert" className="text-sm text-red-600">
            {actionError}
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full px-3 py-1 ${done ? "bg-emerald-500/10 text-emerald-600" : "bg-app text-muted"}`}
          >
            {done ? "Выполнена" : "Открыта"}
          </span>
          <span className="bg-app rounded-full px-3 py-1">Приоритет: {priorityLabels[task.priority]}</span>
        </div>
        <p className="text-sm [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
          {task.description || "Описание не добавлено"}
        </p>
        <dl className="bg-app grid grid-cols-1 gap-3 rounded-2xl p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted text-xs">Срок</dt>
            <dd>
              {formatTaskDate(task.dueDate)} · {task.dueTime?.slice(0, 5) ?? "до конца дня"}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Владелец</dt>
            <dd>{task.setter?.fullName ?? "Не назначен"}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Создал</dt>
            <dd>
              {task.createdBy?.fullName ?? "—"}
              <span className="text-muted block text-xs">{formatTaskInstant(task.createdAt, task.timezone)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Условие выполнения</dt>
            <dd>{task.completionMode === "EACH" ? "Должен выполнить каждый" : "Достаточно одного исполнителя"}</dd>
          </div>
          {done && (
            <div className="sm:col-span-2">
              <dt className="text-muted text-xs">Завершение</dt>
              <dd>
                {formatTaskInstant(task.completedAt, task.timezone)}
                {task.completedBy ? ` · ${task.completedBy.fullName}` : ""}
                {task.completionReason === "AUDIENCE_CHANGED" ? " · после изменения состава" : ""}
              </dd>
            </div>
          )}
        </dl>
        <section className="space-y-3">
          <h3 className="font-semibold">
            Участники{" "}
            {task.completionMode === "EACH"
              ? `· ${task.completedCount} из ${task.participantCount}`
              : `· ${task.participantCount}`}
          </h3>
          {task.completionMode === "EACH" && (
            <progress
              className="h-2 w-full accent-emerald-600"
              value={task.completedCount}
              max={Math.max(task.participantCount, 1)}
              aria-label="Прогресс выполнения"
            />
          )}
          {!task.participantCount && <p className="text-muted text-sm">Нет исполнителей. Задача остаётся открытой.</p>}
          {task.participants.map((p) => (
            <div
              key={p.memberId}
              className={`border-subtle flex justify-between gap-3 rounded-xl border p-3 text-sm ${!p.active ? "opacity-65" : ""}`}
            >
              <div>
                {p.name}
                <span className="text-muted block text-xs">
                  {p.positionName}
                  {!p.active ? " · больше не участвует" : ""}
                </span>
              </div>
              <span className={`text-right text-xs ${p.completedAt ? "text-emerald-600" : "text-muted"}`}>
                {p.completedAt
                  ? formatTaskInstant(p.completedAt, task.timezone)
                  : p.active && task.completionMode === "EACH"
                    ? "Ожидается"
                    : "—"}
              </span>
            </div>
          ))}
        </section>
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <MessageSquare size={17} />
            Комментарии {page ? `· ${page.totalItems}` : ""}
          </h3>
          {error && (
            <div role="alert" className="text-sm text-red-600">
              {error}
              <Button size="sm" variant="ghost" onClick={() => setRevision((v) => v + 1)}>
                Обновить
              </Button>
            </div>
          )}
          {!page && loading ? (
            <p role="status" className="text-muted text-sm">
              Загружаем…
            </p>
          ) : (
            page && (
              <>
                {page.items.length ? (
                  page.items.map((c) => (
                    <div key={c.id} className="border-subtle rounded-2xl border p-3">
                      <div className="text-muted flex justify-between gap-2 text-xs">
                        <span>{c.author?.fullName ?? "Сотрудник"}</span>
                        <span>{formatTaskInstant(c.createdAt, task.timezone)}</span>
                      </div>
                      <p className="mt-2 text-sm [overflow-wrap:anywhere] break-words whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted text-sm">Комментариев пока нет.</p>
                )}
                {page.hasNext && (
                  <Button variant="outline" size="sm" onClick={() => void more()} disabled={loading}>
                    {loading ? "Загружаем…" : "Загрузить ещё"}
                  </Button>
                )}
              </>
            )
          )}
          <label className="block">
            <span className="sr-only">Комментарий</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Напишите комментарий…"
              maxLength={10000}
              disabled={!page || sending}
              rows={3}
              className="border-subtle bg-surface w-full rounded-2xl border p-3 text-sm"
            />
          </label>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void send()} disabled={!text.trim() || sending || !page}>
              {sending ? "Отправляем…" : "Отправить"}
            </Button>
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="font-semibold">История изменений</h3>
          {task.events.map((e) => (
            <div key={e.id} className="border-subtle border-l-2 pl-3 text-sm">
              <p>
                {e.actorName} · {e.text}
              </p>
              <p className="text-muted text-xs">{formatTaskInstant(e.createdAt, task.timezone)}</p>
            </div>
          ))}
        </section>
      </div>
    </Modal>
  );
}

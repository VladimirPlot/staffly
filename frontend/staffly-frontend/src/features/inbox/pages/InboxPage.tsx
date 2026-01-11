import React from "react";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ContentText from "../../../shared/ui/ContentText";
import { useAuth } from "../../../shared/providers/AuthProvider";
import {
  fetchInbox,
  hideInboxMessage,
  markInboxRead,
  restoreInboxMessage,
  type InboxMessageDto,
  type InboxStateFilter,
  type InboxTypeFilter,
} from "../api";

const typeFilters: { id: InboxTypeFilter; label: string }[] = [
  { id: "ALL", label: "Все" },
  { id: "BIRTHDAY", label: "ДР" },
  { id: "EVENT", label: "События" },
  { id: "ANNOUNCEMENT", label: "Объявления" },
];

const stateFilters: { id: InboxStateFilter; label: string }[] = [
  { id: "UNREAD", label: "Новые" },
  { id: "READ", label: "Прочитанные" },
  { id: "HIDDEN", label: "Скрытые" },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long" }).format(d);
}

function formatCreated(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(d);
}

const InboxPage: React.FC = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [typeFilter, setTypeFilter] = React.useState<InboxTypeFilter>("ALL");
  const [state, setState] = React.useState<InboxStateFilter>("UNREAD");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<InboxMessageDto[]>([]);
  const [page, setPage] = React.useState(0);
  const [hasNext, setHasNext] = React.useState(false);

  const loadPage = React.useCallback(
    async (targetPage: number, replace = false) => {
      if (!restaurantId) return;
      setLoading(true);
      try {
        const data = await fetchInbox(restaurantId, {
          type: typeFilter,
          state,
          page: targetPage,
          size: 20,
        });
        setMessages((prev) => (replace ? data.items : [...prev, ...data.items]));
        setPage(data.page);
        setHasNext(data.hasNext);
      } catch (e) {
        console.error("Failed to load inbox", e);
        if (replace) {
          setMessages([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [restaurantId, state, typeFilter],
  );

  React.useEffect(() => {
    setMessages([]);
    setPage(0);
    setHasNext(false);
    void loadPage(0, true);
  }, [loadPage]);

  const handleRead = React.useCallback(
    async (id: number) => {
      if (!restaurantId) return;
      try {
        await markInboxRead(restaurantId, id);
        await loadPage(0, true);
      } catch (e) {
        console.error("Failed to mark read", e);
      }
    },
    [restaurantId, loadPage],
  );

  const handleHide = React.useCallback(
    async (id: number) => {
      if (!restaurantId) return;
      try {
        await hideInboxMessage(restaurantId, id);
        await loadPage(0, true);
      } catch (e) {
        console.error("Failed to hide", e);
      }
    },
    [restaurantId, loadPage],
  );

  const handleRestore = React.useCallback(
    async (id: number) => {
      if (!restaurantId) return;
      try {
        await restoreInboxMessage(restaurantId, id);
        await loadPage(0, true);
      } catch (e) {
        console.error("Failed to restore", e);
      }
    },
    [restaurantId, loadPage],
  );

  const emptyLabel = loading ? "Загружаем сообщения…" : "Сообщений нет";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3">
        <BackToHome />
      </div>
      <h2 className="text-2xl font-semibold">Входящие</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Единый список сообщений с фильтрами по типам и статусам.
      </p>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {stateFilters.map((item) => (
            <Button
              key={item.id}
              variant={state === item.id ? "primary" : "outline"}
              onClick={() => setState(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((item) => (
            <Button
              key={item.id}
              variant={typeFilter === item.id ? "primary" : "outline"}
              onClick={() => setTypeFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-sm text-zinc-600">{emptyLabel}</div>
        ) : (
          messages.map((message) => (
            <Card
              key={message.id}
              className={
                state === "HIDDEN"
                  ? "border-zinc-200 bg-zinc-50/70"
                  : "border-zinc-200"
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-zinc-500">
                    {message.createdBy?.name ?? "Система"}
                    {message.createdAt ? `, ${formatCreated(message.createdAt)}` : ""}
                  </div>
                  {message.type === "BIRTHDAY" && message.expiresAt && (
                    <div className="mt-1 text-xs text-amber-600">
                      Ближайший день рождения: {formatDate(message.expiresAt)}
                    </div>
                  )}
                  {message.type === "ANNOUNCEMENT" && (
                    <div className="mt-1 text-xs text-zinc-500">
                      {message.expiresAt
                        ? `Действует до ${formatDate(message.expiresAt)}`
                        : "Без срока"}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  {!message.isRead && state !== "HIDDEN" && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                      Новые
                    </span>
                  )}
                  {state === "HIDDEN" && message.isHidden && (
                    <span className="rounded-full bg-zinc-100 px-2 py-1">Скрыто</span>
                  )}
                  {state === "HIDDEN" && message.isExpired && (
                    <span className="rounded-full bg-zinc-100 px-2 py-1">Истекло</span>
                  )}
                </div>
              </div>
              <ContentText
                className={`mt-2 text-base ${state === "HIDDEN" ? "text-zinc-700" : "text-zinc-900"}`}
              >
                {message.content}
              </ContentText>
              <div className="mt-4 flex flex-wrap gap-2">
                {!message.isRead && state !== "HIDDEN" && (
                  <Button variant="outline" onClick={() => void handleRead(message.id)}>
                    Прочитано
                  </Button>
                )}
                {state === "HIDDEN" ? (
                  <Button variant="outline" onClick={() => void handleRestore(message.id)}>
                    Вернуть
                  </Button>
                ) : (
                  !message.isHidden && (
                    <Button variant="ghost" onClick={() => void handleHide(message.id)}>
                      Скрыть
                    </Button>
                  )
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {hasNext && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void loadPage(page + 1)}
          >
            Загрузить ещё
          </Button>
        </div>
      )}
    </div>
  );
};

export default InboxPage;

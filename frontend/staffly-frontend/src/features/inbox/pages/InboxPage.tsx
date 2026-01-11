import React from "react";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ContentText from "../../../shared/ui/ContentText";
import { useAuth } from "../../../shared/providers/AuthProvider";
import {
  archiveInboxMessage,
  fetchInbox,
  markInboxRead,
  type InboxMessageDto,
  type InboxTab,
  type InboxView,
} from "../api";

const tabs: { id: InboxTab; label: string }[] = [
  { id: "BIRTHDAY", label: "ДР" },
  { id: "EVENT", label: "События" },
  { id: "ANNOUNCEMENT", label: "Объявления" },
];

const views: { id: InboxView; label: string }[] = [
  { id: "UNREAD", label: "Новые" },
  { id: "ALL", label: "Все" },
  { id: "ARCHIVED", label: "Архив" },
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
  const [tab, setTab] = React.useState<InboxTab>("BIRTHDAY");
  const [view, setView] = React.useState<InboxView>("UNREAD");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<InboxMessageDto[]>([]);

  const load = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await fetchInbox(restaurantId, { tab, view, page: 0, size: 50 });
      setMessages(data.items);
    } catch (e) {
      console.error("Failed to load inbox", e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, tab, view]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleRead = React.useCallback(
    async (id: number) => {
      if (!restaurantId) return;
      try {
        await markInboxRead(restaurantId, id);
        await load(); // <-- важно
      } catch (e) {
        console.error("Failed to mark read", e);
      }
    },
    [restaurantId, load],
  );

  const handleArchive = React.useCallback(
    async (id: number) => {
      if (!restaurantId) return;
      try {
        await archiveInboxMessage(restaurantId, id);
        await load(); // <-- важно
      } catch (e) {
        console.error("Failed to archive", e);
      }
    },
    [restaurantId, load],
  );

  const emptyLabel = loading ? "Загружаем сообщения…" : "Сообщений нет";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3">
        <BackToHome />
      </div>
      <h2 className="text-2xl font-semibold">Входящие</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Все уведомления собраны по вкладкам. Отмечайте прочитанными или архивируйте.
      </p>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "primary" : "outline"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {views.map((item) => (
          <Button
            key={item.id}
            variant={view === item.id ? "primary" : "outline"}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-sm text-zinc-600">{emptyLabel}</div>
        ) : (
          messages.map((message) => (
            <Card key={message.id} className="border-zinc-200">
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
                  {!message.isRead && <span className="rounded-full bg-emerald-50 px-2 py-1">Новые</span>}
                  {message.isArchived && <span className="rounded-full bg-zinc-100 px-2 py-1">Архив</span>}
                  {message.isExpired && <span className="rounded-full bg-zinc-100 px-2 py-1">Истекло</span>}
                </div>
              </div>
              <ContentText className="mt-2 text-base text-zinc-900">{message.content}</ContentText>
              <div className="mt-4 flex flex-wrap gap-2">
                {!message.isRead && view !== "ARCHIVED" && (
                  <Button variant="outline" onClick={() => void handleRead(message.id)}>
                    Прочитано
                  </Button>
                )}
                {!message.isArchived && (
                  <Button variant="ghost" onClick={() => void handleArchive(message.id)}>
                    Архивировать
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default InboxPage;

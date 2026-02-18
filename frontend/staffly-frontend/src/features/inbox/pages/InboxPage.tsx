import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ContentText from "../../../shared/ui/ContentText";
import Icon from "../../../shared/ui/Icon";
import PageLoader from "../../../shared/ui/PageLoader";
import { useAuth } from "../../../shared/providers/AuthProvider";
import {
  fetchInbox,
  hideInboxMessage,
  markInboxRead,
  restoreInboxMessage,
  type InboxMessageDto,
  type InboxStateFilter,
} from "../api";

const stateFilters: { id: InboxStateFilter; label: string }[] = [
  { id: "UNREAD", label: "Новые" },
  { id: "READ", label: "Прочитанные" },
  { id: "HIDDEN", label: "Скрытые" },
];

function formatCreated(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(d);
}

const InboxPage = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [state, setState] = useState<InboxStateFilter>("UNREAD");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<InboxMessageDto[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  const notifyInboxChanged = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("inbox:changed"));
  }, []);

  const loadPage = useCallback(
    async (targetPage: number, replace = false) => {
      if (!restaurantId) return;
      setLoading(true);
      try {
        const data = await fetchInbox(restaurantId, {
          type: "ALL",
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
    [restaurantId, state]
  );

  useEffect(() => {
    setMessages([]);
    setPage(0);
    setHasNext(false);
    void loadPage(0, true);
  }, [loadPage]);

  const handleRead = useCallback(
    async (id: number) => {
      if (!restaurantId) return;
      try {
        await markInboxRead(restaurantId, id);
        setMessages((prev) => {
          if (state === "UNREAD") {
            return prev.filter((item) => item.id !== id);
          }
          return prev.map((item) => (item.id === id ? { ...item, isRead: true } : item));
        });
        notifyInboxChanged();
      } catch (e) {
        console.error("Failed to mark read", e);
      }
    },
    [restaurantId, state, notifyInboxChanged]
  );

  const handleHide = useCallback(
    async (id: number) => {
      if (!restaurantId) return;
      try {
        await hideInboxMessage(restaurantId, id);
        await loadPage(0, true);
        notifyInboxChanged();
      } catch (e) {
        console.error("Failed to hide", e);
      }
    },
    [restaurantId, loadPage, notifyInboxChanged]
  );

  const handleRestore = useCallback(
    async (id: number) => {
      if (!restaurantId) return;
      try {
        await restoreInboxMessage(restaurantId, id);
        await loadPage(0, true);
        notifyInboxChanged();
      } catch (e) {
        console.error("Failed to restore", e);
      }
    },
    [restaurantId, loadPage, notifyInboxChanged]
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3">
        <BackToHome />
      </div>
      <h2 className="text-2xl font-semibold">Входящие</h2>
      <p className="mb-4 text-sm text-muted">Единый список сообщений с фильтрами по статусам.</p>

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
      </div>

      <div className="mt-4 space-y-3">
        {messages.length === 0 && loading ? (
          <PageLoader />
        ) : messages.length === 0 ? (
          <Card className="text-sm text-muted">Сообщений нет</Card>
        ) : (
          messages.map((message) => {
            const canShowHideAction =
              !(state === "HIDDEN" && message.isExpired && !message.isHidden);

            const showEyeButton =
              canShowHideAction &&
              ((state === "HIDDEN" && message.isHidden) || (state !== "HIDDEN" && !message.isHidden));

            const needsFooter = !message.isRead && state !== "HIDDEN";

            return (
              <Card
                key={message.id}
                className={`border-subtle ${state === "HIDDEN" ? "bg-app/70" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted">
                      {message.createdBy?.name ?? "Система"}
                      {message.createdAt ? `, ${formatCreated(message.createdAt)}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted">
                      {!message.isRead && state !== "HIDDEN" && (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                          Новые
                        </span>
                      )}
                      {state === "HIDDEN" && message.isExpired && (
                        <span className="rounded-full bg-app px-2 py-1">Истекло</span>
                      )}
                    </div>

                    {showEyeButton && (
                      state === "HIDDEN" ? (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => void handleRestore(message.id)}
                          aria-label="Вернуть уведомление"
                          title="Вернуть уведомление"
                        >
                          <Icon icon={Eye} size="sm" decorative />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => void handleHide(message.id)}
                          aria-label="Скрыть уведомление"
                          title="Скрыть уведомление"
                        >
                          <Icon icon={EyeOff} size="sm" decorative />
                        </Button>
                      )
                    )}
                  </div>
                </div>

                <ContentText
                  className={`mt-2 text-base ${state === "HIDDEN" ? "text-default" : "text-strong"}`}
                >
                  {message.content}
                </ContentText>

                {needsFooter && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => void handleRead(message.id)}>
                      Прочитано
                    </Button>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {hasNext && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" disabled={loading} onClick={() => void loadPage(page + 1)}>
            Загрузить ещё
          </Button>
        </div>
      )}
    </div>
  );
};

export default InboxPage;

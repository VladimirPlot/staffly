import React from "react";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import ContentText from "../../../shared/ui/ContentText";
import { Link } from "react-router-dom";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { fetchRestaurantName } from "../../restaurants/api";
import { fetchMyRoleIn } from "../../employees/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import { fetchInbox, fetchInboxMarkers, type InboxMessageDto } from "../../inbox/api";
import { listSavedSchedules, type ScheduleSummary } from "../../schedule/api";
import { fetchUnreadAnonymousLetters } from "../../anonymousLetters/api";
import DashboardGrid, { type DashboardCardItem } from "../components/DashboardGrid";
import { useDashboardDnD } from "../hooks/useDashboardDnD";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import {
  AlarmClock,
  CalendarCog,
  CalendarDays,
  GraduationCap,
  LayoutList,
  ListChecks,
  MailQuestion,
  Megaphone,
  Phone,
  Users,
} from "lucide-react";

function formatNotificationDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(d);
}

export default function RestaurantHome() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [name, setName] = React.useState<string>("");
  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);
  const [announcementsPreview, setAnnouncementsPreview] = React.useState<InboxMessageDto[]>([]);
  const [announcementsPreviewHidden, setAnnouncementsPreviewHidden] = React.useState(false);
  const [savedSchedules, setSavedSchedules] = React.useState<ScheduleSummary[]>([]);
  const [hasUnreadAnonymousLetters, setHasUnreadAnonymousLetters] = React.useState(false);
  const [hasUnreadScheduleEvents, setHasUnreadScheduleEvents] = React.useState(false);
  const {
    layout,
    setLayout,
    isLoading: isLayoutLoading,
    loadError,
    persistLayout,
  } = useDashboardLayout(restaurantId);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // Название ресторана
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (restaurantId) {
        try {
          const n = await fetchRestaurantName(restaurantId);
          if (alive) setName(n);
        } catch {
          if (alive) setName("");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  // Моя роль в ресторане
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!restaurantId) {
        if (alive) setMyRole(null);
        return;
      }
      try {
        const role = await fetchMyRoleIn(restaurantId);
        if (alive) setMyRole(role);
      } catch {
        if (alive) setMyRole(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  // Инбокс для превью
  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setAnnouncementsPreview([]);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const { items } = await fetchInbox(restaurantId, {
          type: "ANNOUNCEMENT",
          state: "UNREAD",
          page: 0,
          size: 3,
        });
        if (!alive) return;
        setAnnouncementsPreview(items);
      } catch {
        if (!alive) return;
        setAnnouncementsPreview([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  // Скрытие блока объявлений (localStorage)
  React.useEffect(() => {
    if (!user?.restaurantId || !user?.id) {
      setAnnouncementsPreviewHidden(false);
      return;
    }
    if (typeof window === "undefined") return;
    const key = `restaurant:${restaurantId}:announcementsPreviewHidden:${user.id}`;
    setAnnouncementsPreviewHidden(window.localStorage.getItem(key) === "1");
  }, [restaurantId, user?.restaurantId, user?.id]);

  const hideNotifications = React.useCallback(() => {
    if (!restaurantId || !user?.id) return;
    setAnnouncementsPreviewHidden(true);
    if (typeof window !== "undefined") {
      const key = `restaurant:${restaurantId}:announcementsPreviewHidden:${user.id}`;
      window.localStorage.setItem(key, "1");
    }
  }, [restaurantId, user?.id]);

  const showNotifications = React.useCallback(() => {
    if (!restaurantId || !user?.id) return;
    setAnnouncementsPreviewHidden(false);
    if (typeof window !== "undefined") {
      const key = `restaurant:${restaurantId}:announcementsPreviewHidden:${user.id}`;
      window.localStorage.removeItem(key);
    }
  }, [restaurantId, user?.id]);

  const access = React.useMemo(
    () => resolveRestaurantAccess(user?.roles, myRole),
    [user?.roles, myRole]
  );

  const canAccessSchedules = access.isAdminLike || Boolean(access.normalizedRestaurantRole);
  const canManageNotifications = access.isAdminLike || access.normalizedRestaurantRole === "MANAGER";

  const hasPendingSavedSchedules = React.useMemo(
    () => savedSchedules.some((item) => item.hasPendingShiftRequests),
    [savedSchedules]
  );

  const hasRelevantNotifications = announcementsPreview.length > 0;
  const shouldShowNotificationsEntry = canManageNotifications;
  const canAccessContacts = access.isManagerLike;
  const canAccessMasterSchedules = access.isManagerLike;
  const hasScheduleIndicator = hasPendingSavedSchedules || hasUnreadScheduleEvents;

  const dashboardCards = React.useMemo<DashboardCardItem[]>(
    () => [
      {
        id: "employees",
        title: "Сотрудники",
        description: "Приглашайте сотрудников и назначайте роли/позиции.",
        to: "/employees/invite",
        icon: Users,
      },
      ...(shouldShowNotificationsEntry
        ? [
            {
              id: "announcements",
              title: "Объявления",
              description: canManageNotifications
                ? "Создавайте и редактируйте сообщения для сотрудников."
                : "Посмотрите новые сообщения от руководства.",
              to: "/announcements",
              icon: Megaphone,
            },
          ]
        : []),
      ...(canAccessContacts
        ? [
            {
              id: "contacts",
              title: "Контакты",
              description: "Храните телефоны и информацию о важных поставщиках и службах.",
              to: "/contacts",
              icon: Phone,
            },
          ]
        : []),
      {
        id: "anonymous-letter",
        title: "Анонимное письмо",
        description: "Отправьте обращение руководителю ресторана или прочитайте новые письма.",
        to: "/anonymous-letter",
        icon: MailQuestion,
        showIndicator: hasUnreadAnonymousLetters,
      },
      ...(canAccessSchedules
        ? [
            {
              id: "schedule",
              title: "График",
              description: "Создавайте смены и распределяйте сотрудников по дням.",
              to: "/schedule",
              icon: CalendarDays,
              showIndicator: hasScheduleIndicator,
            },
          ]
        : []),
      ...(canAccessMasterSchedules
        ? [
            {
              id: "master-schedule",
              title: "Мастер график",
              description: "Планируйте ФОТ и рассчитывайте LC% по периодам.",
              to: "/master-schedules",
              icon: CalendarCog,
            },
          ]
        : []),
      {
        id: "training",
        title: "Тренинг",
        description: "Категории и карточки меню, бара, вина и сервиса",
        to: "/training",
        icon: GraduationCap,
      },
      {
        id: "tasks",
        title: "Доска задач",
        description: "Назначайте задачи сотрудникам и следите за сроками.",
        to: "/tasks",
        icon: LayoutList,
      },
      {
        id: "checklists",
        title: "Чек-листы",
        description: "Готовые инструкции для сотрудников",
        to: "/checklists",
        icon: ListChecks,
      },
      {
        id: "reminders",
        title: "Напоминания",
        description: "Регулярные напоминания для сотрудников и команд",
        to: "/reminders",
        icon: AlarmClock,
      },
    ],
    [
      canAccessContacts,
      canAccessMasterSchedules,
      canAccessSchedules,
      canManageNotifications,
      hasScheduleIndicator,
      hasUnreadAnonymousLetters,
      shouldShowNotificationsEntry,
    ]
  );

  const availableIds = React.useMemo(
    () => dashboardCards.map((card) => card.id),
    [dashboardCards]
  );

  const resolvedOrder = React.useMemo(() => {
    const order = new Set<string>();
    layout.forEach((id) => {
      if (availableIds.includes(id)) order.add(id);
    });
    availableIds.forEach((id) => order.add(id));
    return Array.from(order);
  }, [layout, availableIds]);

  React.useEffect(() => {
    const current = layout.join("|");
    const resolved = resolvedOrder.join("|");
    if (current !== resolved) {
      setLayout(resolvedOrder);
    }
  }, [layout, resolvedOrder, setLayout]);

  const dashboardDnD = useDashboardDnD({
    items: resolvedOrder,
    onChange: setLayout,
  });
  const { isReorderMode, isDragging, setIsReorderMode } = dashboardDnD;

  const exitReorderMode = React.useCallback(async () => {
    if (!isReorderMode) return;
    setIsReorderMode(false);
    const result = await persistLayout(layout);
    if (!result?.ok) {
      setToastMessage("Сервер сейчас недоступен, попробуйте позже");
    }
  }, [isReorderMode, layout, persistLayout, setIsReorderMode]);

  const handleReorderBackgroundPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isReorderMode) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-dashboard-card]")) return;

      void exitReorderMode();
    },
    [exitReorderMode, isReorderMode]
  );

  // Сохранённые графики (для индикатора зелёной точки)
  React.useEffect(() => {
    let alive = true;
    if (!restaurantId || !canAccessSchedules) {
      setSavedSchedules([]);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const schedules = await listSavedSchedules(restaurantId);
        if (!alive) return;
        setSavedSchedules(schedules);
      } catch {
        if (!alive) return;
        setSavedSchedules([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId, canAccessSchedules]);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId || access.normalizedRestaurantRole !== "ADMIN") {
      setHasUnreadAnonymousLetters(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const { hasUnread } = await fetchUnreadAnonymousLetters(restaurantId);
        if (!alive) return;
        setHasUnreadAnonymousLetters(hasUnread);
      } catch {
        if (!alive) return;
        setHasUnreadAnonymousLetters(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId, access.normalizedRestaurantRole]);

  // Разовое скрытие уведомлений сотрудником:
  // сохраняем состояние только локально
  const hideAndDismissNotifications = React.useCallback(() => {
    hideNotifications();
  }, [hideNotifications]);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setHasUnreadScheduleEvents(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const data = await fetchInboxMarkers(restaurantId);
        if (!alive) return;
        setHasUnreadScheduleEvents(data.hasScheduleEvents);
      } catch {
        if (!alive) return;
        setHasUnreadScheduleEvents(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="mb-4">
        <div className="text-sm text-zinc-500">Ресторан</div>
        <h2 className="text-2xl font-semibold">{name || "…"}</h2>
      </Card>

      {!canManageNotifications && hasRelevantNotifications &&
        (announcementsPreviewHidden ? (
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" className="text-sm text-zinc-600" onClick={showNotifications}>
              Показать объявления
            </Button>
          </div>
        ) : (
          <Card className="mb-4 border-emerald-200 bg-emerald-50/70">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <div className="text-sm font-medium uppercase tracking-wide text-emerald-700">
                  Новые объявления
                </div>
                <ul className="space-y-3 text-sm text-emerald-900">
                  {announcementsPreview.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-emerald-100 bg-white/60 p-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-700">
                        <span>{item.createdBy?.name ?? "Руководство"}</span>
                        <span>до {formatNotificationDate(item.expiresAt)}</span>
                      </div>
                      <ContentText className="mt-2 text-base text-emerald-900">
                        {item.content}
                      </ContentText>
                    </li>
                  ))}
                </ul>
                <Link to="/inbox" className="inline-flex text-xs text-emerald-700 underline">
                  Перейти во входящие
                </Link>
              </div>
              <Button
                variant="ghost"
                className="text-sm text-emerald-700"
                onClick={hideAndDismissNotifications}
              >
                Скрыть
              </Button>
            </div>
          </Card>
        ))}

      <div className="space-y-3">
        {isLayoutLoading && (
          <div className="text-xs text-zinc-500">Загрузка порядка карточек…</div>
        )}
        {loadError && <div className="text-xs text-zinc-500">{loadError}</div>}
        {isReorderMode && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => void exitReorderMode()}>
              Готово
            </Button>
          </div>
        )}
        <div onPointerUp={handleReorderBackgroundPointerUp}>
          <DashboardGrid cards={dashboardCards} order={resolvedOrder} dndState={dashboardDnD} />
        </div>
      </div>
      {toastMessage && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <div className="pointer-events-auto rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}

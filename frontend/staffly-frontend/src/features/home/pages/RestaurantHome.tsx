import React from "react";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import { Link } from "react-router-dom";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { fetchRestaurantName } from "../../restaurants/api";
import { fetchMyRoleIn, listMembers, type MemberDto } from "../../employees/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import {
  listNotifications,
  type NotificationDto,
  dismissNotification,
} from "../../notifications/api";
import { listSavedSchedules, type ScheduleSummary } from "../../schedule/api";
import { fetchUnreadAnonymousLetters } from "../../anonymousLetters/api";

type UpcomingBirthday = {
  id: number;
  name: string;
  formattedDate: string;
  nextOccurrence: Date;
};

function displayNameOf(m: MemberDto): string {
  if (m.fullName && m.fullName.trim()) return m.fullName.trim();
  const ln = (m.lastName || "").trim();
  const fn = (m.firstName || "").trim();
  const both = [ln, fn].filter(Boolean).join(" ").trim();
  return both || "Без имени";
}

function computeUpcomingBirthdays(members: MemberDto[]): UpcomingBirthday[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  });

  return members
    .map((member) => {
      if (!member.birthDate) return null;
      const birth = new Date(member.birthDate);
      if (Number.isNaN(birth.getTime())) return null;

      const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
      if (next < today) {
        next.setFullYear(next.getFullYear() + 1);
      }

      const diffMs = next.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const MAX_DAYS_AHEAD = 7;
      if (diffDays < 0 || diffDays > MAX_DAYS_AHEAD) return null;

      return {
        id: member.id,
        name: displayNameOf(member),
        formattedDate: formatter.format(next),
        nextOccurrence: next,
      } satisfies UpcomingBirthday;
    })
    .filter((v): v is UpcomingBirthday => Boolean(v))
    .sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime());
}

function isActiveNotification(n: NotificationDto): boolean {
  const expires = new Date(n.expiresAt);
  if (Number.isNaN(expires.getTime())) return true;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return expires.getTime() >= now.getTime();
}

function formatNotificationDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(d);
}

export default function RestaurantHome() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [name, setName] = React.useState<string>("");
  const [upcomingBirthdays, setUpcomingBirthdays] = React.useState<UpcomingBirthday[]>([]);
  const [birthdaysHidden, setBirthdaysHidden] = React.useState(false);
  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);
  const [notifications, setNotifications] = React.useState<NotificationDto[]>([]);
  const [notificationsHidden, setNotificationsHidden] = React.useState(false);
  const [myMembership, setMyMembership] = React.useState<MemberDto | null>(null);
  const [savedSchedules, setSavedSchedules] = React.useState<ScheduleSummary[]>([]);
  const [hasUnreadAnonymousLetters, setHasUnreadAnonymousLetters] = React.useState(false);

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

  // Участники, дни рождения и моя membership-запись
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!restaurantId) {
        if (alive) setUpcomingBirthdays([]);
        if (alive) setMyMembership(null);
        return;
      }
      try {
        const members = await listMembers(restaurantId);
        if (!alive) return;
        setUpcomingBirthdays(computeUpcomingBirthdays(members));
        const self = members.find((member) => member.userId === user?.id) ?? null;
        setMyMembership(self);
      } catch {
        if (!alive) return;
        setUpcomingBirthdays([]);
        setMyMembership(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId, user?.id]);

  // Уведомления из бэкенда
  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setNotifications([]);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const notifications = await listNotifications(restaurantId);
        if (!alive) return;
        setNotifications(notifications.filter(isActiveNotification));
      } catch {
        if (!alive) return;
        setNotifications([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  // Скрытие дней рождения (localStorage)
  React.useEffect(() => {
    if (!user?.restaurantId) {
      setBirthdaysHidden(false);
      return;
    }
    if (typeof window === "undefined") return;
    const key = `restaurant:${restaurantId}:birthdaysHidden`;
    setBirthdaysHidden(window.localStorage.getItem(key) === "1");
  }, [restaurantId, user?.restaurantId]);

  const hideBirthdays = React.useCallback(() => {
    setBirthdaysHidden(true);
    if (typeof window !== "undefined" && restaurantId) {
      const key = `restaurant:${restaurantId}:birthdaysHidden`;
      window.localStorage.setItem(key, "1");
    }
  }, [restaurantId]);

  const showBirthdays = React.useCallback(() => {
    setBirthdaysHidden(false);
    if (typeof window !== "undefined" && restaurantId) {
      const key = `restaurant:${restaurantId}:birthdaysHidden`;
      window.localStorage.removeItem(key);
    }
  }, [restaurantId]);

  // Скрытие блока уведомлений (localStorage)
  React.useEffect(() => {
    if (!user?.restaurantId || !user?.id) {
      setNotificationsHidden(false);
      return;
    }
    if (typeof window === "undefined") return;
    const key = `restaurant:${restaurantId}:notificationsHidden:${user.id}`;
    setNotificationsHidden(window.localStorage.getItem(key) === "1");
  }, [restaurantId, user?.restaurantId, user?.id]);

  const hideNotifications = React.useCallback(() => {
    if (!restaurantId || !user?.id) return;
    setNotificationsHidden(true);
    if (typeof window !== "undefined") {
      const key = `restaurant:${restaurantId}:notificationsHidden:${user.id}`;
      window.localStorage.setItem(key, "1");
    }
  }, [restaurantId, user?.id]);

  const showNotifications = React.useCallback(() => {
    if (!restaurantId || !user?.id) return;
    setNotificationsHidden(false);
    if (typeof window !== "undefined") {
      const key = `restaurant:${restaurantId}:notificationsHidden:${user.id}`;
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

  const relevantNotifications = React.useMemo(() => {
    if (canManageNotifications) return notifications;
    if (!notifications.length) return [];
    const positionId = myMembership?.positionId;
    return notifications.filter((item) => {
      if (item.positions.length === 0) return true;
      if (!positionId) return false;
      return item.positions.some((p) => p.id === positionId);
    });
  }, [canManageNotifications, notifications, myMembership?.positionId]);

  const hasRelevantNotifications = relevantNotifications.length > 0;
  const shouldShowNotificationsEntry = canManageNotifications;
  const canAccessContacts = access.isManagerLike;

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
  // помечаем их dismissed на бэкенде + убираем из локального стейта + прячем блок через localStorage
  const hideAndDismissNotifications = React.useCallback(async () => {
    if (!restaurantId) return;
    if (!relevantNotifications.length) {
      hideNotifications();
      return;
    }

    const toDismiss = relevantNotifications;

    try {
      await Promise.all(
        toDismiss.map((n) => dismissNotification(restaurantId, n.id))
      );

      setNotifications((prev) =>
        prev.filter((item) => !toDismiss.some((n) => n.id === item.id))
      );
    } catch (e) {
      console.error("Failed to dismiss notifications", e);
    }

    hideNotifications();
  }, [restaurantId, relevantNotifications, hideNotifications]);

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="mb-4">
        <div className="text-sm text-zinc-500">Ресторан</div>
        <h2 className="text-2xl font-semibold">{name || "…"}</h2>
      </Card>

      {upcomingBirthdays.length > 0 &&
        (birthdaysHidden ? (
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" className="text-sm text-zinc-600" onClick={showBirthdays}>
              Показать дни рождения
            </Button>
          </div>
        ) : (
          <Card className="mb-4 bg-amber-50/70 border-amber-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium uppercase tracking-wide text-amber-600">
                  Скоро день рождения!
                </div>
                <ul className="mt-3 space-y-2 text-sm text-amber-900">
                  {upcomingBirthdays.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-amber-700">{item.formattedDate}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button variant="ghost" className="text-sm text-amber-700" onClick={hideBirthdays}>
                Скрыть
              </Button>
            </div>
          </Card>
        ))}

      {!canManageNotifications && hasRelevantNotifications &&
        (notificationsHidden ? (
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" className="text-sm text-zinc-600" onClick={showNotifications}>
              Показать уведомления
            </Button>
          </div>
        ) : (
          <Card className="mb-4 border-emerald-200 bg-emerald-50/70">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="text-sm font-medium uppercase tracking-wide text-emerald-700">
                  Новые уведомления
                </div>
                <ul className="space-y-3 text-sm text-emerald-900">
                  {relevantNotifications.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-emerald-100 bg-white/60 p-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-700">
                        <span>{item.createdBy?.name ?? "Руководство"}</span>
                        <span>до {formatNotificationDate(item.expiresAt)}</span>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-base text-emerald-900">
                        {item.content}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                variant="ghost"
                className="text-sm text-emerald-700"
                onClick={() => void hideAndDismissNotifications()}
              >
                Скрыть
              </Button>
            </div>
          </Card>
        ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/employees/invite"
          className="block rounded-3xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        >
          <div className="text-lg font-semibold">Сотрудники</div>
          <div className="mt-1 text-sm text-zinc-600">
            Приглашайте сотрудников и назначайте роли/позиции.
          </div>
        </Link>

        {shouldShowNotificationsEntry && (
          <Link
            to="/notifications"
            className="block rounded-3xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
          >
            <div className="text-lg font-semibold">Уведомления</div>
            <div className="mt-1 text-sm text-zinc-600">
              {canManageNotifications
                ? "Создавайте и редактируйте сообщения для сотрудников."
                : "Посмотрите новые сообщения от руководства."}
            </div>
            {!canManageNotifications && hasRelevantNotifications && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                Есть новые уведомления
              </div>
            )}
          </Link>
        )}

        <Link
          to="/anonymous-letter"
          className="relative block rounded-3xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        >
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span>Анонимное письмо</span>
            {hasUnreadAnonymousLetters && (
              <span
                className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                aria-label="Есть непрочитанные письма"
              />
            )}
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            Отправьте обращение руководителю ресторана или прочитайте новые письма.
          </div>
        </Link>

        {canAccessSchedules && (
          <Link
            to="/schedule"
            className="relative block rounded-3xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
          >
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span>График</span>
              {hasPendingSavedSchedules && (
                <span
                  className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                  aria-label="Есть необработанные заявки"
                />
              )}
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              Создавайте смены и распределяйте сотрудников по дням.
            </div>
          </Link>
        )}

        <Link to="/training" className="block">
          <Card className="h-full hover:bg-zinc-50">
            <div className="text-lg font-medium mb-1">Тренинг</div>
            <div className="text-sm text-zinc-600">
              Категории и карточки меню, бара, вина и сервиса
            </div>
          </Card>
        </Link>

        <Link to="/checklists" className="block">
          <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-medium mb-1">Чек-листы</div>
                <div className="text-sm text-zinc-600">
                  Готовые инструкции для сотрудников
                </div>
              </div>
            </div>
          </Card>
        </Link>

        {canAccessContacts && (
          <Link to="/contacts" className="block">
            <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-medium mb-1">Контакты</div>
                  <div className="text-sm text-zinc-600">
                    Список важных номеров и заметок ресторана
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}

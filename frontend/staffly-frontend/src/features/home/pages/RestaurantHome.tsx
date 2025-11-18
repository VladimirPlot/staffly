import React from "react";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import { Link } from "react-router-dom";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { fetchRestaurantName } from "../../restaurants/api";
import { fetchMyRoleIn, listMembers, type MemberDto } from "../../employees/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { resolveRestaurantAccess } from "../../../shared/utils/access";

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

export default function RestaurantHome() {
  const { user } = useAuth();
  const [name, setName] = React.useState<string>("");
  const [upcomingBirthdays, setUpcomingBirthdays] = React.useState<UpcomingBirthday[]>([]);
  const [birthdaysHidden, setBirthdaysHidden] = React.useState(false);
  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (user?.restaurantId) {
        try {
          const n = await fetchRestaurantName(user.restaurantId);
          if (alive) setName(n);
        } catch {
          if (alive) setName("");
        }
      }
    })();
    return () => { alive = false; };
  }, [user?.restaurantId]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.restaurantId) {
        if (alive) setMyRole(null);
        return;
      }
      try {
        const role = await fetchMyRoleIn(user.restaurantId);
        if (alive) setMyRole(role);
      } catch {
        if (alive) setMyRole(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.restaurantId]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.restaurantId) {
        if (alive) setUpcomingBirthdays([]);
        return;
      }
      try {
        const members = await listMembers(user.restaurantId);
        if (!alive) return;
        setUpcomingBirthdays(computeUpcomingBirthdays(members));
      } catch {
        if (!alive) return;
        setUpcomingBirthdays([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.restaurantId]);

  React.useEffect(() => {
    if (!user?.restaurantId) {
      setBirthdaysHidden(false);
      return;
    }
    if (typeof window === "undefined") return;
    const key = `restaurant:${user.restaurantId}:birthdaysHidden`;
    setBirthdaysHidden(window.localStorage.getItem(key) === "1");
  }, [user?.restaurantId]);

  const hideBirthdays = React.useCallback(() => {
    setBirthdaysHidden(true);
    if (typeof window !== "undefined" && user?.restaurantId) {
      const key = `restaurant:${user.restaurantId}:birthdaysHidden`;
      window.localStorage.setItem(key, "1");
    }
  }, [user?.restaurantId]);

  const showBirthdays = React.useCallback(() => {
    setBirthdaysHidden(false);
    if (typeof window !== "undefined" && user?.restaurantId) {
      const key = `restaurant:${user.restaurantId}:birthdaysHidden`;
      window.localStorage.removeItem(key);
    }
  }, [user?.restaurantId]);

  const access = React.useMemo(
    () => resolveRestaurantAccess(user?.roles, myRole),
    [user?.roles, myRole]
  );

  const canAccessSchedules = access.isAdminLike || Boolean(access.normalizedRestaurantRole);

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="mb-4">
        <div className="text-sm text-zinc-500">Ресторан</div>
        <h2 className="text-2xl font-semibold">{name || "…"}</h2>
      </Card>

      {upcomingBirthdays.length > 0 && (
        birthdaysHidden ? (
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
                    <li key={item.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
        )
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/employees/invite"
          className="block rounded-3xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        >
          <div className="text-lg font-semibold">Участники</div>
          <div className="mt-1 text-sm text-zinc-600">
            Приглашайте сотрудников и назначайте роли/позиции.
          </div>
        </Link>

        {canAccessSchedules && (
          <Link
            to="/schedule"
            className="block rounded-3xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
          >
            <div className="text-lg font-semibold">График</div>
            <div className="mt-1 text-sm text-zinc-600">
              Создавайте смены и распределяйте сотрудников по дням.
            </div>
          </Link>
        )}

        <Link to="/training" className="block">
          <Card className="h-full hover:bg-zinc-50">
            <div className="text-lg font-medium mb-1">Тренинг</div>
            <div className="text-sm text-zinc-600">Категории и карточки меню, бара, вина и сервиса</div>
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
      </div>
    </div>
  );
}

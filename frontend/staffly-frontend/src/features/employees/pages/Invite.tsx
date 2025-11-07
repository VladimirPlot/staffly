import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Input from "../../../shared/ui/Input";
import Button from "../../../shared/ui/Button";
import BackToHome from "../../../shared/ui/BackToHome";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { resolveRestaurantAccess } from "../../../shared/utils/access";

import {
  listPositions,
  type PositionDto,
  type RestaurantRole, // "ADMIN" | "MANAGER" | "STAFF"
} from "../../dictionaries/api";

import {
  inviteEmployee,
  type InviteRole, // "ADMIN" | "MANAGER" | "STAFF"
} from "../../invitations/api";

import {
  listMembers,
  fetchMyRoleIn,
  removeMember as removeMemberApi,
  type MemberDto,
} from "../../employees/api";

const ROLE_LABEL: Record<RestaurantRole, string> = {
  ADMIN: "Админ",
  MANAGER: "Менеджер",
  STAFF: "Сотрудник",
};

function formatBirthday(b?: string | null): string {
  if (!b) return "—";
  const d = new Date(b);
  if (isNaN(d.getTime())) return "—";
  // показываем только день-месяц
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function displayNameOf(m: MemberDto): string {
  if (m.fullName && m.fullName.trim()) return m.fullName.trim();
  const ln = (m.lastName || "").trim();
  const fn = (m.firstName || "").trim();
  const both = [ln, fn].filter(Boolean).join(" ").trim();
  return both || "Без имени";
}

// какие уровни позиций разрешены для выбранной роли
function allowedLevelsFor(role: InviteRole): RestaurantRole[] {
  switch (role) {
    case "ADMIN":
      return ["ADMIN", "MANAGER", "STAFF"];
    case "MANAGER":
      return ["MANAGER", "STAFF"];
    case "STAFF":
    default:
      return ["STAFF"];
  }
}

export default function InvitePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  // Моя роль в текущем ресторане (управляет правами UI)
  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);

  // Список участников
  const [members, setMembers] = React.useState<MemberDto[]>([]);
  const [loadingMembers, setLoadingMembers] = React.useState(true);
  const [membersError, setMembersError] = React.useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = React.useState<MemberDto | null>(null);
  const [removing, setRemoving] = React.useState(false);
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  // Должности
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [loadingPositions, setLoadingPositions] = React.useState(true);

  // Форма приглашения (показываем только по кнопке и только если есть права)
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [phoneOrEmail, setPhoneOrEmail] = React.useState("");
  const [role, setRole] = React.useState<InviteRole>("STAFF");
  const [positionId, setPositionId] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [inviteDone, setInviteDone] = React.useState(false);

  const access = React.useMemo(
    () => resolveRestaurantAccess(user?.roles, myRole),
    [user?.roles, myRole]
  );

  const canInvite = access.isManagerLike;
  const roleOptions: InviteRole[] = access.isAdminLike
    ? ["ADMIN", "MANAGER", "STAFF"]
    : ["STAFF"];

  // 1) тянем мою роль и участников
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!restaurantId) return;
      try {
        setLoadingMembers(true);
        setMembersError(null);

        const [r, mems] = await Promise.all([
          fetchMyRoleIn(restaurantId),
          listMembers(restaurantId),
        ]);

        if (!alive) return;
        setMyRole(r);
        setMembers(mems);
      } catch (e: any) {
        if (!alive) return;
        setMembers([]);
        setMembersError(e?.response?.data?.message || e?.message || "Не удалось загрузить участников");
      } finally {
        if (alive) setLoadingMembers(false);
      }
    })();
    return () => { alive = false; };
  }, [restaurantId]);

  const currentUserId = user?.id ?? null;
  const adminsCount = React.useMemo(
    () => members.filter((m) => m.role === "ADMIN").length,
    [members]
  );

  const canRemoveMember = React.useCallback(
    (member: MemberDto) => {
      if (!currentUserId) return false;
      const isSelf = member.userId === currentUserId;

      if (!access.isManagerLike) {
        return isSelf;
      }

      if (access.isAdminLike) {
        if (!access.isCreator && isSelf && member.role === "ADMIN" && adminsCount <= 1) {
          return false;
        }
        return true;
      }

      if (isSelf) return true;
      return member.role === "STAFF";
    },
    [access.isAdminLike, access.isCreator, access.isManagerLike, adminsCount, currentUserId]
  );

  const closeRemoveDialog = React.useCallback(() => {
    if (removing) return;
    setMemberToRemove(null);
    setRemoveError(null);
  }, [removing]);

  const confirmRemoveMember = React.useCallback(async () => {
    if (!restaurantId || !memberToRemove) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await removeMemberApi(restaurantId, memberToRemove.id);
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      if (memberToRemove.userId === currentUserId) {
        setMyRole(null);
      }
      setMemberToRemove(null);
    } catch (e: any) {
      setRemoveError(
        e?.response?.data?.message || e?.message || "Не удалось исключить участника"
      );
    } finally {
      setRemoving(false);
    }
  }, [currentUserId, memberToRemove, restaurantId]);

  const memberRemovalDescription = React.useMemo(() => {
    if (!memberToRemove) return null;
    const isSelf = currentUserId != null && memberToRemove.userId === currentUserId;
    return (
      <div className="space-y-3">
        <p>
          {isSelf
            ? "Вы действительно хотите покинуть ресторан? После подтверждения вы потеряете доступ к его данным."
            : `Вы действительно хотите исключить ${displayNameOf(memberToRemove)} из ресторана?`}
        </p>
        {removeError && <div className="text-sm text-red-600">{removeError}</div>}
      </div>
    );
  }, [currentUserId, memberToRemove, removeError]);

  const memberRemovalTitle = React.useMemo(() => {
    if (!memberToRemove) return "";
    return currentUserId != null && memberToRemove.userId === currentUserId
      ? "Покинуть ресторан?"
      : "Исключить участника?";
  }, [currentUserId, memberToRemove]);

  const memberRemovalConfirmText = React.useMemo(() => {
    if (!memberToRemove) return "Исключить";
    return currentUserId != null && memberToRemove.userId === currentUserId
      ? "Покинуть"
      : "Исключить";
  }, [currentUserId, memberToRemove]);
  // 2) тянем должности (активные). Сервер может уметь фильтровать по роли — пробуем прокинуть.
  const loadPositions = React.useCallback(async (filterByRole?: InviteRole) => {
    if (!restaurantId) return;
    setLoadingPositions(true);
    try {
      const data = await listPositions(
        restaurantId,
        filterByRole ? { includeInactive: false, role: filterByRole } : { includeInactive: false }
      );
      // Доп. защита: даже если бэк не фильтрует — отфильтруем тут
      const allowed = allowedLevelsFor(filterByRole ?? role);
      const filtered = data.filter((p) => allowed.includes(p.level));
      setPositions(filtered);
      // если текущая позиция не подходит под новый фильтр — сбросим на первую
      if (filtered.length > 0) {
        if (!positionId || !filtered.some((p) => p.id === positionId)) {
          setPositionId(filtered[0].id);
        }
      } else {
        setPositionId(null);
      }
    } finally {
      setLoadingPositions(false);
    }
  }, [restaurantId, role, positionId]);

  React.useEffect(() => {
    if (restaurantId) void loadPositions(role);
  }, [restaurantId, role, loadPositions]);

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <div className="text-sm text-zinc-700">Сначала выберите ресторан.</div>
          <div className="mt-3">
            <Button variant="outline" onClick={() => navigate("/restaurants")}>К выбору ресторанов</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3"><BackToHome /></div>
      {/* Блок: Участники */}
      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Участники</h2>
          {canInvite && (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/dictionaries/positions"
                className="rounded-2xl border border-zinc-300 px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-zinc-50"
              >
                Справочники
              </Link>
              <Button variant="outline" onClick={() => setInviteOpen((v) => !v)}>
                {inviteOpen ? "Скрыть приглашение" : "Пригласить сотрудника"}
              </Button>
            </div>
          )}
        </div>

        {loadingMembers ? (
          <div>Загрузка участников…</div>
        ) : membersError ? (
          <div className="text-red-600">{membersError}</div>
        ) : members.length === 0 ? (
          <div className="text-zinc-600">Пока нет участников.</div>
        ) : (
          <div className="divide-y">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-medium">{displayNameOf(m)}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
                    <span className="rounded-full border px-2 py-0.5">
                      {m.positionName || ROLE_LABEL[m.role]}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <div className="text-sm text-zinc-700">
                    День рождения: <span className="font-medium">{formatBirthday(m.birthDate)}</span>
                  </div>
                  {canRemoveMember(m) && (
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setRemoveError(null);
                        setMemberToRemove(m);
                      }}
                      disabled={removing && memberToRemove?.id === m.id}
                    >
                      Исключить
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Блок: Форма приглашения (только MANAGER / ADMIN, только по кнопке) */}
      {canInvite && inviteOpen && (
        <Card>
          {inviteDone ? (
            <div className="space-y-4">
              <div className="text-emerald-700">
                Приглашение отправлено! Пользователь увидит его в разделе «Мои приглашения».
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { setInviteDone(false); setPhoneOrEmail(""); }}>Отправить ещё</Button>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Готово</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <Input
                label="Телефон или Email приглашённого"
                value={phoneOrEmail}
                onChange={(e) => setPhoneOrEmail(e.target.value)}
                placeholder="+79990000000 или name@example.com"
              />

              {/* Селект роли: админ видит все, менеджер — только STAFF */}
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-600">Роль доступа</span>
                <select
                  className="w-full rounded-2xl border border-zinc-300 p-3 outline-none transition focus:ring-2 focus:ring-zinc-300"
                  value={role}
                  onChange={(e) => setRole(e.target.value as InviteRole)}
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r as RestaurantRole] || r}</option>
                  ))}
                </select>
              </label>

              {/* Селект должности: список автоматически фильтруется под выбранную роль */}
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-600">Должность</span>
                <select
                  className="w-full rounded-2xl border border-zinc-300 p-3 outline-none transition focus:ring-2 focus:ring-zinc-300"
                  value={positionId ?? ""}
                  onChange={(e) => setPositionId(e.target.value ? Number(e.target.value) : null)}
                >
                  {loadingPositions ? (
                    <option value="">Загрузка…</option>
                  ) : positions.length === 0 ? (
                    <option value="">Нет подходящих должностей</option>
                  ) : (
                    positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({ROLE_LABEL[p.level]})
                      </option>
                    ))
                  )}
                </select>
              </label>

              {inviteError && <div className="text-sm text-red-600">{inviteError}</div>}

              <div className="mt-2 flex gap-2">
                <Button
                  disabled={!phoneOrEmail.trim() || submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    setInviteError(null);
                    try {
                      await inviteEmployee(restaurantId, {
                        phoneOrEmail: phoneOrEmail.trim(),
                        role,
                        positionId: positionId ?? undefined, // опционально
                      });
                      setInviteDone(true);
                    } catch (e: any) {
                      setInviteError(e?.response?.data?.message || e?.message || "Не удалось отправить приглашение");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {submitting ? "Отправляем…" : "Отправить приглашение"}
                </Button>

                <Button variant="outline" onClick={() => setInviteOpen(false)}>Отмена</Button>
              </div>

              <div className="text-xs text-zinc-500">
                Права на отправку приглашений проверяются на бэке: MANAGER может приглашать только STAFF.
              </div>
            </div>
          )}
        </Card>
      )}
      <ConfirmDialog
        open={!!memberToRemove}
        title={memberRemovalTitle}
        description={memberRemovalDescription}
        confirmText={memberRemovalConfirmText}
        cancelText="Отмена"
        confirming={removing}
        onConfirm={confirmRemoveMember}
        onCancel={closeRemoveDialog}
      />
    </div>
  );
}

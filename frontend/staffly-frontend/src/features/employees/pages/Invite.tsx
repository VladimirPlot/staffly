import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Input from "../../../shared/ui/Input";
import Button from "../../../shared/ui/Button";
import BackToHome from "../../../shared/ui/BackToHome";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import Avatar from "../../../shared/ui/Avatar";
import Modal from "../../../shared/ui/Modal";
import Icon from "../../../shared/ui/Icon";
import { Pencil, Trash2 } from "lucide-react";

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
  updateMemberRole,
  updateMemberPosition,
  type MemberDto,
} from "../../employees/api";

const ROLE_LABEL: Record<RestaurantRole, string> = {
  ADMIN: "Админ",
  MANAGER: "Менеджер",
  STAFF: "Сотрудник",
};

const ROLE_PRIORITY: Record<RestaurantRole, number> = {
  ADMIN: 0,
  MANAGER: 1,
  STAFF: 2,
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

function positionKeyOf(member: MemberDto): string | null {
  const label = (member.positionName ?? "").trim();
  if (member.positionId != null) return `id:${member.positionId}`;
  if (label) return `name:${label}`;
  return null;
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
  const [positionFilter, setPositionFilter] = React.useState<string | null>(null);

  // Должности
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [loadingPositions, setLoadingPositions] = React.useState(true);
  const [allPositions, setAllPositions] = React.useState<PositionDto[]>([]);
  const [loadingAllPositions, setLoadingAllPositions] = React.useState(true);
  const [positionsError, setPositionsError] = React.useState<string | null>(null);

  // Форма приглашения (показываем только по кнопке и только если есть права)
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [phoneOrEmail, setPhoneOrEmail] = React.useState("");
  const [role, setRole] = React.useState<InviteRole>("STAFF");
  const [positionId, setPositionId] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [inviteDone, setInviteDone] = React.useState(false);

  // Редактирование участника
  const [memberToEdit, setMemberToEdit] = React.useState<MemberDto | null>(null);
  const [editPositionId, setEditPositionId] = React.useState<number | null>(null);
  const [savingPosition, setSavingPosition] = React.useState(false);
  const [updatePositionError, setUpdatePositionError] = React.useState<string | null>(null);

  const access = React.useMemo(
    () => resolveRestaurantAccess(user?.roles, myRole),
    [user?.roles, myRole]
  );

  const isStaffInCurrentRestaurant = myRole === "STAFF";

  const canInvite = access.isManagerLike && !isStaffInCurrentRestaurant;
  const canEditMembers = myRole === "ADMIN";
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
      setMembersError(e?.friendlyMessage || "Не удалось загрузить участников");
    } finally {
      if (alive) setLoadingMembers(false);
    }
    })();
    return () => { alive = false; };
  }, [restaurantId]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!restaurantId) return;
      try {
        setLoadingAllPositions(true);
        setPositionsError(null);
        const data = await listPositions(restaurantId, { includeInactive: false });
        if (!alive) return;
        setAllPositions(data);
      } catch (e: any) {
        if (!alive) return;
        setPositionsError(e?.friendlyMessage || "Не удалось загрузить должности");
      } finally {
        if (alive) setLoadingAllPositions(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const currentUserId = user?.id ?? null;
  const adminsCount = React.useMemo(
    () => members.filter((m) => m.role === "ADMIN").length,
    [members]
  );

  const positionOptions = React.useMemo(
    () => {
      const unique = new Map<string, string>();
      members.forEach((member) => {
        const key = positionKeyOf(member);
        const label = (member.positionName ?? "").trim();
        if (!key || !label) return;
        if (!unique.has(key)) unique.set(key, label);
      });

      const options = Array.from(unique.entries())
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru-RU", { sensitivity: "base" }));

      const hasWithoutPosition = members.some((m) => !m.positionName || !m.positionName.trim());
      if (hasWithoutPosition) {
        options.push({ key: "none", label: "Без должности" });
      }

      return options;
    },
    [members]
  );

  React.useEffect(() => {
    if (!positionFilter) return;
    const optionKeys = positionOptions.map((o) => o.key);
    const hasNoneOption = optionKeys.includes("none");

    if (positionFilter === "none" && !hasNoneOption) {
      setPositionFilter(null);
      return;
    }

    if (positionFilter !== "none" && !optionKeys.includes(positionFilter)) {
      setPositionFilter(null);
    }
  }, [positionFilter, positionOptions]);

  const filteredMembers = React.useMemo(
    () => {
      if (!positionFilter) return members;

      return members.filter((member) => {
        const label = (member.positionName ?? "").trim();
        if (positionFilter === "none") {
          return !label;
        }
        return positionKeyOf(member) === positionFilter;
      });
    },
    [members, positionFilter]
  );

  const sortedMembers = React.useMemo(
    () => {
      return [...filteredMembers].sort((a, b) => {
        const roleDiff = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
        if (roleDiff !== 0) return roleDiff;

        const positionA = (a.positionName ?? "").trim();
        const positionB = (b.positionName ?? "").trim();
        const hasPosA = positionA !== "";
        const hasPosB = positionB !== "";

        if (hasPosA && hasPosB) {
          const positionCompare = positionA.localeCompare(positionB, "ru-RU", { sensitivity: "base" });
          if (positionCompare !== 0) return positionCompare;
        } else if (hasPosA !== hasPosB) {
          return hasPosA ? -1 : 1;
        }

        const nameA = displayNameOf(a).toLocaleLowerCase("ru-RU");
        const nameB = displayNameOf(b).toLocaleLowerCase("ru-RU");
        return nameA.localeCompare(nameB, "ru-RU");
      });
    },
    [filteredMembers]
  );

  const canRemoveMember = React.useCallback(
    (member: MemberDto) => {
      if (!currentUserId) return false;
      const isSelf = member.userId === currentUserId;

      if (!access.isManagerLike || isStaffInCurrentRestaurant) {
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
    [
      access.isAdminLike,
      access.isCreator,
      access.isManagerLike,
      adminsCount,
      currentUserId,
      isStaffInCurrentRestaurant,
    ]
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
      setRemoveError(e?.friendlyMessage || "Не удалось исключить участника");
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

  const editOptions = React.useMemo(() => {
    if (!memberToEdit) return [] as PositionDto[];
    return allPositions.filter((p) => p.active);
  }, [allPositions, memberToEdit]);

  React.useEffect(() => {
    if (!memberToEdit || loadingAllPositions) return;

    const fallbackPositionId =
      memberToEdit.positionId ?? allPositions.find((p) => p.active)?.id ?? null;

    setEditPositionId((prev) => (prev == null ? fallbackPositionId : prev));
  }, [allPositions, loadingAllPositions, memberToEdit]);

  const closeEditDialog = React.useCallback(() => {
    if (savingPosition) return;
    setMemberToEdit(null);
    setUpdatePositionError(null);
  }, [savingPosition]);

  const saveMemberPosition = React.useCallback(async () => {
    if (!restaurantId || !memberToEdit) return;
    if (editPositionId == null) {
      setUpdatePositionError("Выберите должность");
      return;
    }

    const selectedPosition = allPositions.find((p) => p.id === editPositionId);

    if (!selectedPosition) {
      setUpdatePositionError("Выберите должность");
      return;
    }

    setSavingPosition(true);
    setUpdatePositionError(null);
    try {
      if (selectedPosition.level !== memberToEdit.role) {
        await updateMemberRole(restaurantId, memberToEdit.id, selectedPosition.level);
      }

      const updated = await updateMemberPosition(restaurantId, memberToEdit.id, selectedPosition.id);

      setMembers((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      setMemberToEdit(null);
    } catch (e: any) {
      setUpdatePositionError(e?.friendlyMessage || "Не удалось сохранить должность");
    } finally {
      setSavingPosition(false);
    }
  }, [allPositions, editPositionId, memberToEdit, restaurantId]);
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
      {/* Блок: Сотрудники */}
      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Сотрудники</h2>
          {canInvite && (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/dictionaries/positions"
                className="rounded-2xl border border-zinc-300 px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-zinc-50"
              >
                Должности
              </Link>
              <Button variant="outline" onClick={() => setInviteOpen((v) => !v)}>
                {inviteOpen ? "Скрыть приглашение" : "Пригласить сотрудника"}
              </Button>
            </div>
          )}
        </div>

        {canInvite && inviteOpen && (
          <div className="mb-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
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
                        setInviteError(e?.friendlyMessage || "Не удалсь отправить приглашение");
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    {submitting ? "Отправляем…" : "Отправить приглашение"}
                  </Button>

                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Отмена</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {positionOptions.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2 text-zinc-700">
              <span>Фильтр по должности:</span>
              <select
                className="rounded-2xl border border-zinc-300 px-3 py-2 outline-none transition focus:ring-2 focus:ring-zinc-300"
                value={positionFilter ?? ""}
                onChange={(e) => setPositionFilter(e.target.value ? e.target.value : null)}
              >
                <option value="">Все должности</option>
                {positionOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {positionFilter && (
              <Button variant="ghost" className="text-sm" onClick={() => setPositionFilter(null)}>
                Сбросить фильтр
              </Button>
            )}
          </div>
        )}

        {loadingMembers ? (
          <div>Загрузка участников…</div>
        ) : membersError ? (
          <div className="text-red-600">{membersError}</div>
        ) : sortedMembers.length === 0 ? (
          <div className="text-zinc-600">
            {members.length === 0 ? "Пока нет участников." : "Нет участников с выбранной должностью."}
          </div>
        ) : (
          <div className="divide-y">
            {sortedMembers.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar
                    name={displayNameOf(m)}
                    imageUrl={m.avatarUrl ?? undefined}
                    className="flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-medium">{displayNameOf(m)}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
                      <span className="rounded-full border px-2 py-0.5">
                        {m.positionName || ROLE_LABEL[m.role]}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <div className="text-sm text-zinc-700">
                    День рождения: <span className="font-medium">{formatBirthday(m.birthDate)}</span>
                  </div>
                  <div className="text-sm text-zinc-700">
                    Телефон: <span className="font-medium">{m.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEditMembers && (
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Редактировать должность"
                        onClick={() => {
                          setMemberToEdit(m);
                          setEditPositionId(m.positionId ?? null);
                          setUpdatePositionError(null);
                        }}
                        disabled={savingPosition && memberToEdit?.id === m.id}
                        leftIcon={<Icon icon={Pencil} decorative={false} title="Редактировать" />}
                      />
                    )}
                    {canRemoveMember(m) && (
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Исключить"
                        onClick={() => {
                          setRemoveError(null);
                          setMemberToRemove(m);
                        }}
                        disabled={removing && memberToRemove?.id === m.id}
                        leftIcon={<Icon icon={Trash2} decorative={false} title="Исключить" />}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Modal
        open={!!memberToEdit}
        title="Редактировать должность"
        description={
          memberToEdit
            ? `Укажите должность для ${displayNameOf(memberToEdit)}. Доступны только активные должности ресторана.`
            : undefined
        }
        onClose={closeEditDialog}
        footer={
          memberToEdit ? (
            <>
              <Button variant="ghost" onClick={closeEditDialog} disabled={savingPosition}>
                Отменить
              </Button>
              <Button
                onClick={saveMemberPosition}
                disabled={savingPosition || loadingAllPositions || editPositionId == null}
                isLoading={savingPosition}
              >
                Сохранить
              </Button>
            </>
          ) : null
        }
      >
        {loadingAllPositions ? (
          <div className="text-sm text-zinc-700">Загрузка должностей…</div>
        ) : positionsError ? (
          <div className="text-sm text-red-600">{positionsError}</div>
        ) : !memberToEdit ? null : editOptions.length === 0 ? (
          <div className="text-sm text-zinc-700">Нет доступных активных должностей для этой роли.</div>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Должность</span>
            <select
              className="w-full rounded-2xl border border-zinc-300 p-3 outline-none transition focus:ring-2 focus:ring-zinc-300"
              value={editPositionId ?? ""}
              onChange={(e) => setEditPositionId(Number(e.target.value))}
            >
              {editOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {updatePositionError && <div className="mt-2 text-sm text-red-600">{updatePositionError}</div>}
      </Modal>
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

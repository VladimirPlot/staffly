import React from "react";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Icon from "../../../shared/ui/Icon";
import { Pencil, Trash2, Lock, Unlock } from "lucide-react";
import {
  loadMyRestaurants,
  updateRestaurant,
  deleteRestaurant,
  toggleRestaurantLock,
} from "../api";
import { switchRestaurant } from "../../auth/api";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import type { UiRestaurant } from "../../../entities/restaurant/types";
import {
  fetchMyInvites,
  acceptInvite,
  declineInvite,
  type MyInvite,
} from "../../invitations/api";

export default function Restaurants() {
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [restaurants, setRestaurants] = React.useState<UiRestaurant[]>([]);
  const [invites, setInvites] = React.useState<MyInvite[]>([]);
  const [editing, setEditing] = React.useState<UiRestaurant | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editTimezone, setEditTimezone] = React.useState("Europe/Moscow");
  const [editBusy, setEditBusy] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<UiRestaurant | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [lockBusyId, setLockBusyId] = React.useState<number | null>(null);

  const { refreshMe, user } = useAuth();
  const isCreator = !!user?.roles?.includes("CREATOR");

  // Единая функция загрузки
  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, my] = await Promise.all([
        loadMyRestaurants(),
        fetchMyInvites(),
      ]);
      setRestaurants(list);
      setInvites(my);
    } catch {
      setRestaurants([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Грузим, когда профиль пользователя появился/сменился
  React.useEffect(() => {
    if (!user) return;
    void reload();
  }, [user, reload]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Выбор ресторана</h2>
            <div className="w-fit animate-pulse rounded-full border border-subtle px-3 py-1 text-xs text-muted">
              Загружаем рестораны…
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">Выбор ресторана</h2>

          {isCreator && (
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => navigate("/restaurants/new")}
            >
              Создать ресторан
            </Button>
          )}
        </div>

        {invites.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <div className="mb-2 text-sm font-medium">У вас есть приглашения:</div>

            <div className="grid gap-2">
              {invites.map((inv) => (
                <div
                  key={inv.token}
                  className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1 text-sm leading-snug">
                    <div className="font-medium break-words">{inv.restaurantName}</div>
                    <div className="text-default">Права: {inv.desiredRole}</div>
                    {inv.positionName && (
                      <div className="text-default">Дольжность: {inv.positionName}</div>
                    )}
                    <div className="text-xs text-muted">
                      истекает: {new Date(inv.expiresAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={async () => {
                        try {
                      await acceptInvite(inv.token);
                      await switchRestaurant(inv.restaurantId);
                      await refreshMe();
                      navigate("/app", { replace: true });
                    } catch (e: any) {
                      alert(
                        e?.friendlyMessage || "Не удалось принять приглашение"
                      );
                    }
                  }}
                >
                  Принять
                    </Button>

                    <Button
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={async () => {
                      try {
                        await declineInvite(inv.token);
                        setInvites((prev) =>
                          prev.filter((x) => x.token !== inv.token)
                        );
                      } catch (e: any) {
                        alert(
                          e?.friendlyMessage || "Не удалось отклонить"
                        );
                      }
                    }}
                  >
                    Отклонить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {restaurants.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-2xl border border-subtle p-4 hover:bg-app sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-lg font-medium">{r.name}</div>
                <div className="text-sm text-muted">
                  {(r.city || "") + " · Роль: " + r.role}
                </div>
                {r.locked && (
                  <div className="mt-1 text-xs font-medium text-rose-600">
                    Ресторан заблокирован
                  </div>
                )}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  className="w-full sm:w-auto"
                  disabled={r.locked && !isCreator}
                  onClick={async () => {
                    await switchRestaurant(r.id);
                    await refreshMe();
                    navigate("/app", { replace: true });
                  }}
                >
                  Открыть
                </Button>
                {isCreator && (
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Редактировать ресторан"
                      onClick={() => {
                        setEditing(r);
                        setEditName(r.name);
                        setEditDescription(r.description ?? "");
                        setEditTimezone(r.timezone || "Europe/Moscow");
                        setEditError(null);
                      }}
                    >
                      <Icon icon={Pencil} size="sm" decorative />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={r.locked ? "Разблокировать ресторан" : "Заблокировать ресторан"}
                      disabled={lockBusyId === r.id}
                      onClick={async () => {
                        setLockBusyId(r.id);
                        try {
                          const updated = await toggleRestaurantLock(r.id);
                          setRestaurants((prev) =>
                            prev.map((item) =>
                              item.id === r.id
                                ? { ...item, locked: updated.locked }
                                : item
                            )
                          );
                        } catch (e: any) {
                          alert(e?.friendlyMessage || "Не удалось изменить статус");
                        } finally {
                          setLockBusyId(null);
                        }
                      }}
                    >
                      <Icon icon={r.locked ? Unlock : Lock} size="sm" decorative />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Удалить ресторан"
                      onClick={() => {
                        setDeleteTarget(r);
                        setDeleteError(null);
                      }}
                    >
                      <Icon icon={Trash2} size="sm" decorative className="text-rose-600" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={!!editing}
        title="Редактировать ресторан"
        onClose={() => {
          if (!editBusy) {
            setEditing(null);
          }
        }}
      >
        <div className="grid gap-4">
          <Input
            label="Название"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <Input
            label="Описание"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <Input
            label="Часовой пояс (IANA)"
            value={editTimezone}
            onChange={(e) => setEditTimezone(e.target.value)}
            placeholder="Напр. Europe/Moscow"
          />
          {editError && (
            <div className="text-sm text-red-600">{editError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={editBusy}
            >
              Отмена
            </Button>
            <Button
              disabled={!editName.trim() || !editTimezone.trim() || editBusy}
              onClick={async () => {
                if (!editing) return;
                setEditBusy(true);
                setEditError(null);
                try {
                  const updated = await updateRestaurant(editing.id, {
                    name: editName.trim(),
                    description: editDescription.trim() || undefined,
                    timezone: editTimezone.trim(),
                  });
                  setRestaurants((prev) =>
                    prev.map((item) =>
                      item.id === editing.id
                        ? { ...item, ...updated }
                        : item
                    )
                  );
                  setEditing(null);
                } catch (e: any) {
                  setEditError(
                    e?.friendlyMessage || "Не удалось сохранить изменения"
                  );
                } finally {
                  setEditBusy(false);
                }
              }}
            >
              {editBusy ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить ресторан?"
        description={
          deleteError ? (
            <div className="space-y-2">
              <div>Удаление невозможно.</div>
              <div className="text-sm text-red-600">{deleteError}</div>
            </div>
          ) : (
            "Ресторан будет удалён вместе со всеми данными. Это действие нельзя отменить."
          )
        }
        confirmText="Удалить"
        cancelText="Отмена"
        confirming={deleteBusy}
        onCancel={() => {
          if (!deleteBusy) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleteBusy(true);
          setDeleteError(null);
          try {
            await deleteRestaurant(deleteTarget.id);
            setRestaurants((prev) =>
              prev.filter((item) => item.id !== deleteTarget.id)
            );
            setDeleteTarget(null);
          } catch (e: any) {
            setDeleteError(
              e?.friendlyMessage ||
                "Нельзя удалить ресторан, пока в нём есть другие участники"
            );
          } finally {
            setDeleteBusy(false);
          }
        }}
      />
    </div>
  );
}

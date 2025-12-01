import React from "react";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import NotificationDialog from "./NotificationDialog";
import type { NotificationDto, NotificationRequest } from "../api";
import {
  createNotification,
  deleteNotification,
  listNotifications,
  updateNotification,
} from "../api";
import { listPositions, type PositionDto } from "../../dictionaries/api";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(d);
}

type RestaurantNotificationsProps = {
  restaurantId: number;
  canManage: boolean;
  viewerId?: number | null;
};

type HiddenMap = Record<number, string>;

const RestaurantNotifications: React.FC<RestaurantNotificationsProps> = ({
  restaurantId,
  canManage,
  viewerId,
}) => {
  const hiddenKey = React.useMemo(
    () => (viewerId ? `restaurant:${restaurantId}:notifications:hidden:${viewerId}` : null),
    [restaurantId, viewerId],
  );

  const [loading, setLoading] = React.useState<boolean>(true);
  const [notifications, setNotifications] = React.useState<NotificationDto[]>([]);
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<NotificationDto | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<NotificationDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [hidden, setHidden] = React.useState<HiddenMap>({});

  const signatureOf = React.useCallback((n: NotificationDto) => n.updatedAt || n.createdAt, []);

  React.useEffect(() => {
    if (!hiddenKey) {
      setHidden({});
      return;
    }
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(hiddenKey) : null;
    if (!raw) {
      setHidden({});
      return;
    }
    try {
      const parsed = JSON.parse(raw) as HiddenMap;
      setHidden(parsed || {});
    } catch {
      setHidden({});
    }
  }, [hiddenKey]);

  React.useEffect(() => {
    if (!hiddenKey) return;
    setHidden((prev) => {
      const next: HiddenMap = {};
      notifications.forEach((n) => {
        const signature = signatureOf(n);
        if (prev[n.id] && prev[n.id] === signature) {
          next[n.id] = signature;
        }
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(hiddenKey, JSON.stringify(next));
      }
      return next;
    });
  }, [notifications, signatureOf, hiddenKey]);

  const visibleNotifications = React.useMemo(() => {
    if (!notifications.length) return [];
    return notifications.filter((item) => {
      const signature = signatureOf(item);
      return !hidden[item.id] || hidden[item.id] !== signature;
    });
  }, [notifications, hidden, signatureOf]);

  const loadNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await listNotifications(restaurantId);
      setNotifications(data);
    } catch (e) {
      console.error("Failed to load notifications", e);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  React.useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  React.useEffect(() => {
    if (!canManage) return;
    (async () => {
      try {
        const data = await listPositions(restaurantId, { includeInactive: true });
        setPositions(data);
      } catch (e) {
        console.error("Failed to load positions", e);
      }
    })();
  }, [canManage, restaurantId]);

  const openCreate = React.useCallback(() => {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((notification: NotificationDto) => {
    setEditing(notification);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    if (submitting) return;
    setDialogOpen(false);
    setDialogError(null);
    setEditing(null);
  }, [submitting]);

  const handleSubmit = React.useCallback(
    async (payload: NotificationRequest) => {
      setSubmitting(true);
      setDialogError(null);
      try {
        if (editing) {
          await updateNotification(restaurantId, editing.id, payload);
        } else {
          await createNotification(restaurantId, payload);
        }
        setDialogOpen(false);
        setEditing(null);
        await loadNotifications();
      } catch (e: any) {
        console.error("Failed to save notification", e);
        const message = e?.response?.data?.message || e?.message || "Не удалось сохранить";
        setDialogError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [editing, loadNotifications, restaurantId],
  );

  const openDelete = React.useCallback((notification: NotificationDto) => {
    setDeleteTarget(notification);
  }, []);

  const closeDelete = React.useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteNotification(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await loadNotifications();
    } catch (e) {
      console.error("Failed to delete notification", e);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, restaurantId, loadNotifications]);

  const hideNotification = React.useCallback(
    (notification: NotificationDto) => {
      if (!hiddenKey) return;
      const signature = signatureOf(notification);
      setHidden((prev) => {
        const next = { ...prev, [notification.id]: signature };
        if (typeof window !== "undefined") {
          window.localStorage.setItem(hiddenKey, JSON.stringify(next));
        }
        return next;
      });
    },
    [hiddenKey, signatureOf],
  );

  const resetHidden = React.useCallback(() => {
    setHidden({});
    if (hiddenKey && typeof window !== "undefined") {
      window.localStorage.removeItem(hiddenKey);
    }
  }, [hiddenKey]);

  const renderNotification = (notification: NotificationDto) => {
    const createdLabel = notification.createdAt
      ? `${notification.createdBy?.name ?? "Без имени"}, ${formatShortDate(notification.createdAt)}`
      : notification.createdBy?.name ?? "Без имени";

    return (
      <div
        key={notification.id}
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-xs text-zinc-500">{createdLabel}</div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span className="rounded-full bg-zinc-100 px-2 py-1">До {formatDate(notification.expiresAt)}</span>
            {canManage ? (
              <>
                <Button variant="ghost" className="text-sm" onClick={() => openEdit(notification)}>
                  Изменить
                </Button>
                <Button variant="ghost" className="text-sm text-red-600" onClick={() => openDelete(notification)}>
                  Удалить
                </Button>
                <Button
                  variant="ghost"
                  className="text-sm text-zinc-600"
                  onClick={() => hideNotification(notification)}
                >
                  Скрыть
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                className="text-sm text-zinc-600"
                onClick={() => hideNotification(notification)}
              >
                Скрыть
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 whitespace-pre-wrap text-base text-zinc-900">{notification.content}</div>
        {notification.positions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-700">
            {notification.positions.map((p) => (
              <span
                key={p.id}
                className={`rounded-full border px-2 py-1 ${p.active ? "border-zinc-200 bg-zinc-100" : "border-amber-200 bg-amber-50 text-amber-800"}`}
              >
                {p.name}
                {!p.active ? " (неактивна)" : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const emptyState = loading ? (
    <div className="text-sm text-zinc-600">Загружаем уведомления…</div>
  ) : (
    <div className="text-sm text-zinc-600">Пока нет уведомлений</div>
  );

  return (
    <Card className="mb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold text-zinc-900">Уведомления</div>
          <div className="text-sm text-zinc-600">Короткие сообщения для сотрудников по должностям</div>
        </div>
        {canManage && (
          <Button onClick={openCreate}>Создать уведомление</Button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {visibleNotifications.length > 0 ? visibleNotifications.map(renderNotification) : emptyState}
      </div>

      {hiddenKey && notifications.length > 0 && visibleNotifications.length === 0 && Object.keys(hidden).length > 0 && (
        <div className="mt-4 text-right">
          <Button variant="ghost" className="text-sm text-zinc-600" onClick={resetHidden}>
            Показать скрытые уведомления
          </Button>
        </div>
      )}

      <NotificationDialog
        open={dialogOpen}
        title={editing ? "Редактирование уведомления" : "Создать уведомление"}
        positions={positions}
        submitting={submitting}
        submitLabel={editing ? "Сохранить" : "Отправить"}
        error={dialogError}
        initialData={
          editing
            ? {
                content: editing.content,
                expiresAt: editing.expiresAt,
                positionIds: editing.positions.map((p) => p.id),
              }
            : undefined
        }
        onClose={closeDialog}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить уведомление?"
        description="Уведомление исчезнет у всех сотрудников."
        confirming={deleting}
        confirmText="Удалить"
        onCancel={closeDelete}
        onConfirm={confirmDelete}
      />
    </Card>
  );
};

export default RestaurantNotifications;

import { useCallback, useEffect, useState } from "react";
import Card from "../../shared/ui/Card";
import Button from "../../shared/ui/Button";
import ConfirmDialog from "../../shared/ui/ConfirmDialog";
import ContentText from "../../shared/ui/ContentText";
import Icon from "../../shared/ui/Icon";
import AnnouncementDialog from "./AnnouncementDialog";
import type { AnnouncementDto, AnnouncementRequest } from "./api";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from "./api";
import { listPositions, type PositionDto } from "../dictionaries/api";
import { Pencil, Trash2 } from "lucide-react";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(d);
}

type AnnouncementsManagerProps = {
  restaurantId: number;
  canManage: boolean;
  hideHeader?: boolean;
};

const AnnouncementsManager = ({
  restaurantId,
  canManage,
  hideHeader = false,
}: AnnouncementsManagerProps) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAnnouncements(restaurantId);
      setAnnouncements(data);
    } catch (e) {
      console.error("Failed to load announcements", e);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
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

  const openCreate = useCallback(() => {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((announcement: AnnouncementDto) => {
    setEditing(announcement);
    setDialogError(null);
    setDialogOpen(true);
  }, []);


  useEffect(() => {
    function handleOpenDialog() {
      if (!canManage) return;
      openCreate();
    }

    window.addEventListener("open-announcement-dialog", handleOpenDialog);
    return () => {
      window.removeEventListener("open-announcement-dialog", handleOpenDialog);
    };
  }, [canManage, openCreate]);

  const closeDialog = useCallback(() => {
    if (submitting) return;
    setDialogOpen(false);
    setDialogError(null);
    setEditing(null);
  }, [submitting]);

  const handleSubmit = useCallback(
    async (payload: AnnouncementRequest) => {
      setSubmitting(true);
      setDialogError(null);
      try {
        if (editing) {
          await updateAnnouncement(restaurantId, editing.id, payload);
        } else {
          await createAnnouncement(restaurantId, payload);
        }
        setDialogOpen(false);
        setEditing(null);
        await loadAnnouncements();
      } catch (e: any) {
        console.error("Failed to save announcement", e);
        const message = e?.friendlyMessage || "Не удалось сохранить";
        setDialogError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [editing, loadAnnouncements, restaurantId],
  );

  const openDelete = useCallback((announcement: AnnouncementDto) => {
    setDeleteTarget(announcement);
  }, []);

  const closeDelete = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAnnouncement(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await loadAnnouncements();
    } catch (e) {
      console.error("Failed to delete announcement", e);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, restaurantId, loadAnnouncements]);

  const renderAnnouncement = (announcement: AnnouncementDto) => {
    const createdLabel = announcement.createdAt
      ? `${announcement.createdBy?.name ?? "Без имени"}, ${formatShortDate(announcement.createdAt)}`
      : announcement.createdBy?.name ?? "Без имени";

    return (
      <div
        key={announcement.id}
        className="rounded-2xl border border-subtle bg-surface p-4 shadow-[var(--staffly-shadow)]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs text-muted">{createdLabel}</div>
          {canManage && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Изменить"
                onClick={() => openEdit(announcement)}
              >
                <Icon icon={Pencil} size="sm" decorative />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="text-red-600"
                aria-label="Удалить"
                onClick={() => openDelete(announcement)}
              >
                <Icon icon={Trash2} size="sm" decorative />
              </Button>
            </div>
          )}
        </div>
        <ContentText className="mt-2 text-base text-strong">{announcement.content}</ContentText>
        {announcement.positions.length > 0 && (
          <div className="mt-3 text-xs uppercase tracking-wide text-muted">
            {announcement.positions
              .map((position) => `${position.name}${!position.active ? " (неактивна)" : ""}`)
              .join(", ")}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-app px-3 py-1 text-sm text-strong">
            {announcement.expiresAt
              ? `Действует до ${formatDate(announcement.expiresAt)}`
              : "Без даты окончания"}
          </span>
        </div>
      </div>
    );
  };

  const emptyState = (
    <div className="rounded-2xl border border-subtle bg-surface p-4 text-sm text-muted">
      {loading ? "Загружаем объявления…" : "Пока нет объявлений"}
    </div>
  );

  return (
    <Card className="mb-4">
      {!hideHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-strong">Объявления</div>
            <div className="text-sm text-muted">Сообщения руководства по должностям</div>
          </div>
          {canManage && <Button onClick={openCreate}>Создать объявление</Button>}
        </div>
      )}

      <div className={`${hideHeader ? "" : "mt-4 "}space-y-3`}>
        {announcements.length > 0 ? announcements.map(renderAnnouncement) : emptyState}
      </div>

      <AnnouncementDialog
        open={dialogOpen}
        title={editing ? "Редактирование объявления" : "Создать объявление"}
        positions={positions}
        submitting={submitting}
        submitLabel={editing ? "Сохранить" : "Отправить"}
        error={dialogError}
        initialData={
          editing
            ? {
                content: editing.content,
                expiresAt: editing.expiresAt ?? "",
                positionIds: editing.positions.map((p) => p.id),
              }
            : undefined
        }
        onClose={closeDialog}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить объявление?"
        description="Объявление исчезнет у всех сотрудников."
        confirming={deleting}
        confirmText="Удалить"
        onCancel={closeDelete}
        onConfirm={confirmDelete}
      />
    </Card>
  );
};

export default AnnouncementsManager;

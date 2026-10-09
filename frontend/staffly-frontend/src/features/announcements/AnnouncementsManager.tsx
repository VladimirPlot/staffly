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
} from "./api";
import { listPositions, type PositionDto } from "../dictionaries/api";
import { Trash2 } from "lucide-react";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
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
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listAnnouncements(restaurantId);
      setAnnouncements(data);
    } catch (e) {
      console.error("Failed to load announcements", e);
      setLoadError("Не удалось загрузить объявления");
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
  }, [submitting]);

  const handleSubmit = useCallback(
    async (payload: AnnouncementRequest) => {
      setSubmitting(true);
      setDialogError(null);
      try {
        await createAnnouncement(restaurantId, payload);
        setDialogOpen(false);
        await loadAnnouncements();
      } catch (e: any) {
        console.error("Failed to save announcement", e);
        const message = e?.friendlyMessage || "Не удалось отправить объявление";
        setDialogError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [loadAnnouncements, restaurantId],
  );

  const openDelete = useCallback((announcement: AnnouncementDto) => {
    setDeleteError(null);
    setDeleteTarget(announcement);
  }, []);

  const closeDelete = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAnnouncement(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await loadAnnouncements();
    } catch (e) {
      console.error("Failed to delete announcement", e);
      setDeleteError("Не удалось удалить объявление. Попробуйте ещё раз.");
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
                className="text-default"
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
        {loadError && (
          <div className="flex items-center justify-between gap-3 text-sm text-red-600" role="alert">
            <span>{loadError}</span>
            <Button variant="outline" onClick={() => void loadAnnouncements()} disabled={loading}>
              Повторить
            </Button>
          </div>
        )}
        {announcements.length > 0 ? announcements.map(renderAnnouncement) : !loadError && emptyState}
      </div>

      <AnnouncementDialog
        open={dialogOpen}
        positions={positions}
        submitting={submitting}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить объявление?"
        description={
          <>
            <span>Объявление исчезнет из входящих у всех получателей. Уже отправленные push останутся на устройствах.</span>
            {deleteError && <span className="mt-2 block text-red-600" role="alert">{deleteError}</span>}
          </>
        }
        confirming={deleting}
        confirmText="Удалить"
        onCancel={closeDelete}
        onConfirm={confirmDelete}
      />
    </Card>
  );
};

export default AnnouncementsManager;

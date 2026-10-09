import { useCallback, useEffect, useRef, useState } from "react";
import Card from "../../shared/ui/Card";
import Button from "../../shared/ui/Button";
import ConfirmDialog from "../../shared/ui/ConfirmDialog";
import ContentText from "../../shared/ui/ContentText";
import Icon from "../../shared/ui/Icon";
import Modal from "../../shared/ui/Modal";
import AnnouncementDialog from "./AnnouncementDialog";
import type { AnnouncementAudienceOptionsDto, AnnouncementDto, AnnouncementRequest } from "./api";
import { createAnnouncement, deleteAnnouncement, listAnnouncements, fetchAnnouncementAudience } from "./api";
import { announcementAudienceLabel } from "./audience";
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

const AnnouncementsManager = ({ restaurantId, canManage, hideHeader = false }: AnnouncementsManagerProps) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [viewed, setViewed] = useState<AnnouncementDto | null>(null);
  const loadSequence = useRef(0);
  const [audienceOptions, setAudienceOptions] = useState<AnnouncementAudienceOptionsDto | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [audienceReload, setAudienceReload] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadAnnouncements = useCallback(
    async (requestedPage: number) => {
      const sequence = ++loadSequence.current;
      setLoading(true);
      setLoadError(null);
      setAnnouncements([]);
      try {
        const data = await listAnnouncements(restaurantId, requestedPage);
        if (sequence !== loadSequence.current) return;
        const lastPage = Math.max(0, data.totalPages - 1);
        if (requestedPage > lastPage) {
          setPage(lastPage);
          return;
        }
        setAnnouncements(data.items);
        setTotalPages(data.totalPages);
      } catch (e) {
        if (sequence !== loadSequence.current) return;
        console.error("Failed to load announcements", e);
        setLoadError("Не удалось загрузить объявления");
      } finally {
        if (sequence === loadSequence.current) setLoading(false);
      }
    },
    [restaurantId],
  );

  const invalidateLoads = useCallback(() => {
    ++loadSequence.current;
  }, []);

  useEffect(() => {
    void loadAnnouncements(page);
    return invalidateLoads;
  }, [loadAnnouncements, page, invalidateLoads]);

  useEffect(() => {
    if (!canManage || !dialogOpen) return;
    let alive = true;
    setAudienceLoading(true);
    setAudienceError(null);
    setAudienceOptions(null);
    (async () => {
      try {
        const data = await fetchAnnouncementAudience(restaurantId);
        if (alive) setAudienceOptions(data);
      } catch (e) {
        console.error("Failed to load announcement audience", e);
        if (alive) setAudienceError("Не удалось загрузить получателей");
      } finally {
        if (alive) setAudienceLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [canManage, restaurantId, dialogOpen, audienceReload]);

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
        if (page === 0) await loadAnnouncements(0);
        else setPage(0);
      } catch (e: any) {
        console.error("Failed to save announcement", e);
        const message = e?.friendlyMessage || "Не удалось отправить объявление";
        setDialogError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [loadAnnouncements, restaurantId, page],
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
      if (viewed?.id === deleteTarget.id) setViewed(null);
      await loadAnnouncements(page);
    } catch (e) {
      console.error("Failed to delete announcement", e);
      setDeleteError("Не удалось удалить объявление. Попробуйте ещё раз.");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, restaurantId, loadAnnouncements, page, viewed]);

  const pagination = (label: string) =>
    totalPages > 1 && (
      <nav aria-label={label} className="flex items-center justify-between gap-2 py-2">
        <Button variant="outline" disabled={loading || page === 0} onClick={() => setPage(page - 1)}>
          Назад
        </Button>
        <span className="text-muted text-center text-sm">
          Страница {page + 1} из {totalPages}
        </span>
        <Button variant="outline" disabled={loading || page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
          Далее
        </Button>
      </nav>
    );

  const renderAnnouncement = (announcement: AnnouncementDto) => {
    const createdLabel = announcement.createdAt
      ? `${announcement.createdBy?.name ?? "Без имени"}, ${formatShortDate(announcement.createdAt)}`
      : (announcement.createdBy?.name ?? "Без имени");

    return (
      <div
        key={announcement.id}
        className="border-subtle bg-surface relative h-56 rounded-2xl border p-4 shadow-[var(--staffly-shadow)]"
      >
        <button
          type="button"
          onClick={() => setViewed(announcement)}
          aria-label={`Открыть объявление от ${createdLabel}`}
          className="focus:ring-default flex h-full w-full min-w-0 flex-col justify-between rounded-lg text-left focus:ring-2 focus:outline-none"
        >
          <div className="text-muted h-9 w-full truncate pr-12 text-xs">{createdLabel}</div>
          <ContentText className="text-strong line-clamp-3 h-[4.5rem] overflow-hidden text-base leading-6">
            {announcement.content}
          </ContentText>
          <div className="w-full min-w-0">
            <div className="text-muted text-xs">Получателей: {announcement.recipientCount}</div>
            <div className="text-muted mt-1 truncate text-sm">{announcementAudienceLabel(announcement)}</div>
            <div className="text-default mt-2 text-xs">Подробнее</div>
          </div>
        </button>
        {canManage && (
          <Button
            variant="outline"
            size="icon"
            className="text-default absolute top-4 right-4"
            aria-label="Удалить"
            onClick={() => openDelete(announcement)}
          >
            <Icon icon={Trash2} size="sm" decorative />
          </Button>
        )}
      </div>
    );
  };

  const emptyState = (
    <div className="border-subtle bg-surface text-muted rounded-2xl border p-4 text-sm">
      {loading ? "Загружаем объявления…" : "Пока нет объявлений"}
    </div>
  );

  return (
    <Card className="mb-4">
      {!hideHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-strong text-lg font-semibold">Объявления</div>
            <div className="text-muted text-sm">Сообщения руководства участникам ресторана</div>
          </div>
          {canManage && <Button onClick={openCreate}>Создать объявление</Button>}
        </div>
      )}

      <div className={`${hideHeader ? "" : "mt-4"} space-y-3`}>
        {pagination("Страницы объявлений сверху")}
        {loadError && (
          <div className="flex items-center justify-between gap-3 text-sm text-red-600" role="alert">
            <span>{loadError}</span>
            <Button variant="outline" onClick={() => void loadAnnouncements(page)} disabled={loading}>
              Повторить
            </Button>
          </div>
        )}
        {loading
          ? emptyState
          : announcements.length > 0
            ? announcements.map(renderAnnouncement)
            : !loadError && emptyState}
        {pagination("Страницы объявлений снизу")}
      </div>

      <Modal
        open={Boolean(viewed)}
        onClose={() => setViewed(null)}
        title="Объявление"
        headerCloseButton
        footer={
          <Button variant="outline" onClick={() => setViewed(null)}>
            Закрыть
          </Button>
        }
      >
        {viewed && (
          <div className="space-y-4">
            <div className="text-muted text-xs">
              {viewed.createdBy?.name ?? "Без имени"}, {formatShortDate(viewed.createdAt)}
            </div>
            <ContentText>{viewed.content}</ContentText>
            <div>
              <div className="text-muted text-sm">Получателей: {viewed.recipientCount}</div>
              <ContentText className="text-muted mt-1 text-sm">{announcementAudienceLabel(viewed)}</ContentText>
            </div>
          </div>
        )}
      </Modal>

      <AnnouncementDialog
        open={dialogOpen}
        options={audienceOptions}
        loading={audienceLoading}
        loadingError={audienceError}
        onReload={() => setAudienceReload((previous) => previous + 1)}
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
            <span>
              Объявление исчезнет из входящих у всех получателей. Уже отправленные push останутся на устройствах.
            </span>
            {deleteError && (
              <span className="mt-2 block text-red-600" role="alert">
                {deleteError}
              </span>
            )}
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

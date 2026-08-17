import Button from "../../../shared/ui/Button";
import ContentText from "../../../shared/ui/ContentText";
import Modal from "../../../shared/ui/Modal";
import type { ChecklistDto, ChecklistHistoryDetailDto, ChecklistHistorySummaryDto } from "../api";
import type { PhotoPreview } from "../types";
import { formatDateTime, resetReasonLabel } from "../utils/formatters";

type ChecklistHistoryModalProps = {
  target: ChecklistDto | null;
  summaries: ChecklistHistorySummaryDto[];
  detail: ChecklistHistoryDetailDto | null;
  loading: boolean;
  detailLoading: number | null;
  error: string | null;
  onClose: () => void;
  onLoadDetail: (historyId: number) => void;
  onPhotoPreview: (preview: PhotoPreview) => void;
};

export default function ChecklistHistoryModal({
  target,
  summaries,
  detail,
  loading,
  detailLoading,
  error,
  onClose,
  onLoadDetail,
  onPhotoPreview,
}: ChecklistHistoryModalProps) {
  return (
    <Modal
      open={Boolean(target)}
      title={target ? `История: ${target.name}` : "История"}
      onClose={onClose}
      className="max-w-5xl"
      footer={
        <Button variant="outline" onClick={onClose} disabled={loading || detailLoading !== null}>
          Закрыть
        </Button>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        )}
        {loading && <div className="text-muted text-sm">Загрузка истории…</div>}
        {!loading && summaries.length === 0 && (
          <div className="border-subtle text-muted rounded-2xl border p-4 text-sm">История пока не записана.</div>
        )}
        {summaries.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-2">
              {summaries.map((summary) => {
                const selected = detail?.id === summary.id;
                return (
                  <button
                    key={summary.id}
                    type="button"
                    onClick={() => void onLoadDetail(summary.id)}
                    className={`w-full rounded-2xl border p-3 text-left text-sm transition ${
                      selected
                        ? "bg-app text-default border-[var(--staffly-text-strong)]"
                        : "border-subtle bg-surface text-default hover:bg-app"
                    }`}
                  >
                    <div className="font-medium">{formatDateTime(summary.resetAt)}</div>
                    <div className="text-muted mt-1 text-xs">
                      {resetReasonLabel(summary.resetReason)} · {summary.completedItems}/{summary.totalItems}
                    </div>
                    {detailLoading === summary.id && <div className="text-muted mt-1 text-xs">Открываем…</div>}
                  </button>
                );
              })}
            </div>

            <div className="border-subtle min-w-0 rounded-2xl border p-3">
              {!detail && !detailLoading && <div className="text-muted text-sm">Выберите запись истории.</div>}
              {detail && (
                <div className="space-y-4">
                  <div>
                    <div className="text-strong text-sm font-semibold">
                      {formatDateTime(detail.resetAt)} · {resetReasonLabel(detail.resetReason)}
                    </div>
                    <div className="text-muted mt-1 text-xs">
                      Выполнено {detail.completedItems}/{detail.totalItems}
                      {detail.positionsSnapshot ? ` · ${detail.positionsSnapshot}` : ""}
                    </div>
                    {detail.startedAt && (
                      <div className="text-muted mt-1 text-xs">Период с {formatDateTime(detail.startedAt)}</div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {detail.items.map((item) => (
                      <div key={item.id} className="border-subtle bg-app/60 rounded-2xl border p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <ContentText className="text-default min-w-0 text-sm [overflow-wrap:anywhere]">
                            {item.itemOrder}. {item.text}
                          </ContentText>
                          <div className={`text-xs ${item.done ? "text-default font-medium" : "text-muted"}`}>
                            {item.done ? "Выполнено" : "Не выполнено"}
                          </div>
                        </div>
                        <div className="text-muted mt-2 text-xs">
                          {item.done
                            ? `Исполнитель: ${item.doneBy?.name || item.doneByName || "—"}`
                            : item.reservedBy?.name || item.reservedByName
                              ? `Было в работе: ${item.reservedBy?.name || item.reservedByName}`
                              : "Исполнитель: —"}
                          {item.doneAt ? ` · ${formatDateTime(item.doneAt)}` : ""}
                        </div>
                        {(item.examplePhotoUrl || item.completionPhotoUrl) && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {item.examplePhotoUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  onPhotoPreview({
                                    title: "Эталон из истории",
                                    description: item.text,
                                    url: item.examplePhotoUrl!,
                                  })
                                }
                                className="border-subtle bg-surface hover:bg-app focus:ring-default rounded-xl border p-2 text-left transition focus:ring-2 focus:outline-none"
                              >
                                <div className="text-muted mb-2 text-xs font-medium">Эталон</div>
                                <img
                                  src={item.examplePhotoUrl}
                                  alt={`Эталон из истории: ${item.text}`}
                                  className="h-36 w-full rounded-lg object-cover"
                                />
                              </button>
                            )}
                            {item.completionPhotoUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  onPhotoPreview({
                                    title: "Фото выполнения из истории",
                                    description: item.text,
                                    url: item.completionPhotoUrl!,
                                  })
                                }
                                className="border-subtle bg-surface hover:bg-app focus:ring-default rounded-xl border p-2 text-left transition focus:ring-2 focus:outline-none"
                              >
                                <div className="text-muted mb-2 text-xs font-medium">Фото выполнения</div>
                                <img
                                  src={item.completionPhotoUrl}
                                  alt={`Фото выполнения из истории: ${item.text}`}
                                  className="h-36 w-full rounded-lg object-cover"
                                />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

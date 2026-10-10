import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ArrowLeft, Camera } from "lucide-react";
import Button from "../../../shared/ui/Button";
import ContentText from "../../../shared/ui/ContentText";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Icon from "../../../shared/ui/Icon";
import Modal from "../../../shared/ui/Modal";
import type { ChecklistArchiveEntryDto, ChecklistHistoryDetailDto, ChecklistHistorySummaryDto } from "../api";
import type { PhotoPreview } from "../types";
import { formatDateTime, resetReasonLabel } from "../utils/formatters";

type ChecklistHistoryModalProps = {
  target: { id?: number; name: string; legacyHistoryId?: number } | null;
  archiveEntries: ChecklistArchiveEntryDto[];
  archiveNavigation: boolean;
  summaries: ChecklistHistorySummaryDto[];
  detail: ChecklistHistoryDetailDto | null;
  loading: boolean;
  detailLoading: number | null;
  error: string | null;
  hasMore: boolean;
  onSelectArchiveEntry: (entry: ChecklistArchiveEntryDto) => void;
  onBackToArchive: () => void;
  onLoadMore: () => void;
  onClose: () => void;
  onLoadDetail: (historyId: number) => void;
  onPhotoPreview: (preview: PhotoPreview) => void;
};

export default function ChecklistHistoryModal({
  target,
  archiveEntries,
  archiveNavigation,
  summaries,
  detail,
  loading,
  detailLoading,
  error,
  hasMore,
  onSelectArchiveEntry,
  onBackToArchive,
  onLoadMore,
  onClose,
  onLoadDetail,
  onPhotoPreview,
}: ChecklistHistoryModalProps) {
  const [positionFilter, setPositionFilter] = useState("");
  const entryPositions = (entry: ChecklistArchiveEntryDto) =>
    entry.positionNames ??
    entry.positions
      ?.split(",")
      .map((name) => name.trim())
      .filter(Boolean) ??
    [];
  const positionOptions = useMemo(() => {
    const names = archiveEntries.flatMap(
      (entry) =>
        entry.positionNames ??
        entry.positions
          ?.split(",")
          .map((name) => name.trim())
          .filter(Boolean) ??
        [],
    );
    return [...new Set(names)].sort(new Intl.Collator("ru", { sensitivity: "base" }).compare);
  }, [archiveEntries]);
  const filteredEntries = archiveEntries.filter(
    (entry) =>
      positionFilter === "" ||
      (positionFilter === "__without_position__"
        ? entryPositions(entry).length === 0
        : entryPositions(entry).includes(positionFilter)),
  );
  useEffect(() => {
    if (!target) setPositionFilter("");
  }, [target]);
  const isCatalog = target != null && target.id == null && target.legacyHistoryId == null;
  return (
    <Modal
      open={Boolean(target)}
      title={isCatalog ? "Архив чек-листов" : target ? "История: " + target.name : "История"}
      onClose={onClose}
      className="max-w-5xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      <div className="space-y-4">
        {archiveNavigation && !isCatalog && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onBackToArchive}
            leftIcon={<Icon icon={ArrowLeft} size="xs" decorative />}
          >
            К списку чек-листов
          </Button>
        )}
        {error && (
          <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        )}
        {loading && (
          <div className="text-muted text-sm">{isCatalog ? "Загрузка чек-листов…" : "Загрузка истории…"}</div>
        )}
        {isCatalog ? (
          <div className="space-y-2">
            {archiveEntries.length > 0 && (
              <DropdownSelect
                label="Должность"
                value={positionFilter}
                onChange={(event) => setPositionFilter(event.target.value)}
                className="mb-4 max-w-sm"
              >
                <option value="">Все должности</option>
                {positionOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                {archiveEntries.some((entry) => entryPositions(entry).length === 0) && (
                  <option value="__without_position__">Без должности</option>
                )}
              </DropdownSelect>
            )}
            {!loading && archiveEntries.length > 0 && filteredEntries.length === 0 && (
              <div className="text-muted text-sm">Нет чек-листов для выбранной должности.</div>
            )}
            {!loading && archiveEntries.length === 0 && <div className="text-muted text-sm">Чек-листов пока нет.</div>}
            {filteredEntries.map((entry) => (
              <button
                key={entry.checklistId != null ? "checklist-" + entry.checklistId : "legacy-" + entry.legacyHistoryId}
                type="button"
                onClick={() => onSelectArchiveEntry(entry)}
                className="border-subtle bg-surface text-default hover:bg-app focus:ring-default flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition focus:ring-2 focus:outline-none"
              >
                <span className="min-w-0">
                  <span className="text-muted block text-xs [overflow-wrap:anywhere]">
                    {entry.positions || "Без должности"}
                  </span>
                  <span className="mt-1 block text-sm font-medium [overflow-wrap:anywhere]">{entry.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={
                      entry.deleted
                        ? "border-subtle bg-app text-muted rounded-full border px-2.5 py-1 text-xs font-medium"
                        : "rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/45 dark:bg-emerald-500/15 dark:text-emerald-200"
                    }
                  >
                    {entry.deleted ? "Удалён" : "Активен"}
                  </span>
                  <Icon icon={ChevronRight} size="sm" decorative />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {!loading && summaries.length === 0 && (
              <div className="border-subtle text-muted rounded-2xl border p-4 text-sm">История пока не записана.</div>
            )}
            {summaries.map((summary) => {
              const expanded = detail?.id === summary.id;
              const opening = detailLoading === summary.id;
              const panelId = "checklist-history-" + summary.id;
              return (
                <div key={summary.id} className="border-subtle overflow-hidden rounded-2xl border">
                  <button
                    type="button"
                    aria-expanded={expanded || opening}
                    aria-controls={panelId}
                    onClick={() => onLoadDetail(summary.id)}
                    className="bg-surface text-default hover:bg-app focus:ring-default flex w-full items-center justify-between gap-3 p-3 text-left transition focus:ring-2 focus:outline-none"
                  >
                    <span>
                      <span className="block text-sm font-medium">{formatDateTime(summary.resetAt)}</span>
                      <span className="text-muted mt-1 block text-xs">
                        {resetReasonLabel(summary.resetReason)} · {summary.completedItems}/{summary.totalItems}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {opening && <span className="text-muted text-xs">Открываем…</span>}
                      <span className={expanded || opening ? "flex rotate-180" : "flex"}>
                        <Icon icon={ChevronDown} size="sm" decorative />
                      </span>
                    </span>
                  </button>
                  <div id={panelId} hidden={!expanded}>
                    {expanded && detail && (
                      <div className="border-subtle border-t p-3">
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
                                            source: { kind: "history", itemId: item.id, photo: "example" },
                                          })
                                        }
                                        className="border-subtle bg-surface hover:bg-app focus:ring-default rounded-xl border p-2 text-left transition focus:ring-2 focus:outline-none"
                                      >
                                        <div className="text-muted mb-1 text-xs font-medium">Эталон</div>
                                        <span className="text-default inline-flex items-center gap-2 text-sm">
                                          <Icon icon={Camera} size="xs" decorative />
                                          Открыть фото
                                        </span>
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
                                            source: { kind: "history", itemId: item.id, photo: "completion" },
                                          })
                                        }
                                        className="border-subtle bg-surface hover:bg-app focus:ring-default rounded-xl border p-2 text-left transition focus:ring-2 focus:outline-none"
                                      >
                                        <div className="text-muted mb-2 text-xs font-medium">Фото выполнения</div>
                                        <span className="text-default inline-flex items-center gap-2 text-sm">
                                          <Icon icon={Camera} size="xs" decorative />
                                          Открыть фото
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <Button variant="outline" onClick={onLoadMore} disabled={loading}>
                Загрузить ещё
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

import React from "react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import { type PositionDto } from "../../dictionaries/api";
import { type ScheduleSummary } from "../api";
import Icon from "../../../shared/ui/Icon";
import { Download, Pencil, Trash2 } from "lucide-react";

type SavedSchedulesSectionProps = {
  canManage: boolean;
  savedSchedules: ScheduleSummary[];
  positions: PositionDto[];
  positionFilter: number | "all";
  onPositionFilterChange: (value: number | "all") => void;
  onOpenSavedSchedule: (id: number) => void;
  onEditSavedSchedule: (id: number) => void;
  onDeleteSavedSchedule: (id: number) => void;
  onDownloadXlsx: (id: number) => void;
  onDownloadJpg: (id: number) => void;
  downloadMenuFor: number | null;
  onToggleDownloadMenu: (id: number | null) => void;
  downloading: { id: number; type: "xlsx" | "jpg" } | null;
  selectedSavedId: number | null;
  scheduleLoading: boolean;
  hasPendingSavedSchedules: boolean;
  deletingId: number | null;
};

const SavedSchedulesSection: React.FC<SavedSchedulesSectionProps> = ({
  canManage,
  savedSchedules,
  positions,
  positionFilter,
  onPositionFilterChange,
  onOpenSavedSchedule,
  onEditSavedSchedule,
  onDeleteSavedSchedule,
  onDownloadXlsx,
  onDownloadJpg,
  downloadMenuFor,
  onToggleDownloadMenu,
  downloading,
  selectedSavedId,
  scheduleLoading,
  hasPendingSavedSchedules,
  deletingId,
}) => {
  const hasSchedules = savedSchedules.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-default">
            <span>Сохранённые графики</span>
            {hasPendingSavedSchedules && (
              <span
                className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                aria-label="Есть необработанные заявки"
              />
            )}
          </div>
          <div className={`text-xs text-muted ${hasSchedules ? "hidden sm:block" : ""}`}>
            {hasSchedules
              ? "Нажмите «Открыть», чтобы посмотреть график или скачайте файл."
              : canManage
              ? "Пока список пуст. Сохраните график, чтобы увидеть его здесь."
              : "Пока нет сохранённых графиков. Дождитесь, когда менеджер добавит новый график."}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 text-sm text-default">
            <span>Должность:</span>
            <select
              className="rounded-lg border border-subtle bg-surface px-3 py-2 text-base text-default focus:outline-none focus:ring-2 ring-default [color-scheme:dark]"
              value={positionFilter}
              onChange={(e) =>
                onPositionFilterChange(e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">Все</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {hasSchedules && (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {savedSchedules.map((item) => {
              const isActive = selectedSavedId === item.id;
              const isOpening = scheduleLoading && selectedSavedId === item.id;
              const isDownloading = downloading?.id === item.id;
              const isDeleting = deletingId === item.id;
              const menuOpen = downloadMenuFor === item.id;
              return (
                <div
                  key={item.id}
                  className={`relative flex h-full flex-col justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                    isActive
                      ? "border-subtle bg-app"
                      : "border-subtle hover:bg-app"
                  }`}
                >
                  {item.hasPendingShiftRequests && (
                    <span
                      className="absolute right-2 top-2 inline-block h-2 w-2 rounded-full bg-emerald-500"
                      aria-label="Есть необработанные заявки"
                    />
                  )}
                  <div>
                    <div className="font-medium text-strong">{item.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {item.startDate} — {item.endDate}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onOpenSavedSchedule(item.id)}
                      disabled={isActive || isOpening}
                    >
                      {isOpening ? "Открывается…" : isActive ? "Открыт" : "Открыть"}
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onEditSavedSchedule(item.id)}
                          aria-label="Редактировать график"
                          disabled={isOpening || isDeleting}
                        >
                          <Icon icon={Pencil} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onDeleteSavedSchedule(item.id)}
                          aria-label="Удалить график"
                          disabled={isDeleting}
                          className={`text-default ${
                            isDeleting ? "cursor-wait opacity-60" : ""
                          }`}
                        >
                          <Icon icon={Trash2} />
                        </Button>
                      </>
                    )}
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onToggleDownloadMenu(menuOpen ? null : item.id)}
                        disabled={isDownloading}
                        aria-label="Скачать график"
                      >
                        <Icon icon={Download} />
                      </Button>
                      {menuOpen && (
                        <div className="absolute right-0 z-10 mt-2 w-36 rounded-xl border border-subtle bg-surface shadow-[var(--staffly-shadow)]">
                          <button
                            className="block w-full px-3 py-2 text-left text-sm text-default hover:bg-app"
                            onClick={() => {
                              onDownloadXlsx(item.id);
                              onToggleDownloadMenu(null);
                            }}
                          >
                            Скачать .xlsx
                          </button>
                          <button
                            className="block w-full px-3 py-2 text-left text-sm text-default hover:bg-app"
                            onClick={() => {
                              onDownloadJpg(item.id);
                              onToggleDownloadMenu(null);
                            }}
                          >
                            Скачать .jpg
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default SavedSchedulesSection;

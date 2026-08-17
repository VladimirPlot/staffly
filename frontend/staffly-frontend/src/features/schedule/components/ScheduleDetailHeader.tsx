import React from "react";

import Button from "../../../shared/ui/Button";
import { type ScheduleData } from "../types";
import {
  canApplySchedulePreferences,
  canEditScheduleContent,
  canPublishSchedule,
  getScheduleStatusLabel,
  isCollectingPreferences,
  isDraftSchedule,
} from "../utils/status";

type ScheduleDetailHeaderProps = {
  schedule: ScheduleData;
  canManage: boolean;
  scheduleReadOnly: boolean;
  scheduleId: number | null;
  deleting: boolean;
  onEnterEditMode: () => void;
  onDelete: () => void;
  onOpenOwnerDialog: () => void;
  showPublishedDiagnosticsToggle: boolean;
  showPublishedDiagnostics: boolean;
  onTogglePublishedDiagnostics: () => void;
  onOpenPreferences: () => void;
  canViewPreferences: boolean;
  lifecycleAction: "startPreferences" | "closePreferences" | "applyPreferences" | "publish" | null;
  onStartPreferenceCollection: () => void;
  onClosePreferenceCollection: () => void;
  onOpenApplyPreferencesDialog: () => void;
  onPublishSchedule: () => void;
  downloadMenuFor: number | null;
  onToggleDownloadMenu: (id: number | null) => void;
  downloading: { id: number; type: "xlsx" | "jpg" } | null;
  onDownloadXlsx: (id: number) => void;
  onDownloadJpg: (id: number) => void;
  canCreateShiftRequest: boolean;
  onOpenReplacement: () => void;
  onOpenSwap: () => void;
};

const ScheduleDetailHeader: React.FC<ScheduleDetailHeaderProps> = ({
  schedule,
  canManage,
  scheduleReadOnly,
  scheduleId,
  deleting,
  onEnterEditMode,
  onDelete,
  onOpenOwnerDialog,
  showPublishedDiagnosticsToggle,
  showPublishedDiagnostics,
  onTogglePublishedDiagnostics,
  onOpenPreferences,
  canViewPreferences,
  lifecycleAction,
  onStartPreferenceCollection,
  onClosePreferenceCollection,
  onOpenApplyPreferencesDialog,
  onPublishSchedule,
  downloadMenuFor,
  onToggleDownloadMenu,
  downloading,
  onDownloadXlsx,
  onDownloadJpg,
  canCreateShiftRequest,
  onOpenReplacement,
  onOpenSwap,
}) => {
  const ownerName = schedule.owner?.displayName?.trim();
  const ownerMeta = [schedule.owner?.positionName].map((value) => String(value ?? "").trim()).filter(Boolean);
  const createdByName = schedule.createdBy?.displayName?.trim();
  const lifecycleDisabled = deleting || lifecycleAction != null;
  const canEditContent = canEditScheduleContent(schedule.status);
  const applyPreferencesLabel =
    schedule.status === "DRAFT_FROM_PREFERENCES" ? "Сборка по пожеланиям" : "Перейти к сборке";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-strong text-xl font-semibold">{schedule.title}</div>
          <span className="border-subtle bg-surface text-muted rounded-full border px-2 py-0.5 text-xs font-medium">
            {getScheduleStatusLabel(schedule.status)}
          </span>
        </div>
        <div className="text-muted text-sm">
          {schedule.config.startDate} — {schedule.config.endDate}
        </div>
        <div className="text-muted flex flex-col gap-1 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
          <span>
            Ответственный: {ownerName || "не назначен"}
            {ownerMeta.length > 0 && <> · {ownerMeta.join(" · ")}</>}
          </span>
          {createdByName && <span>Создал: {createdByName}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canManage && scheduleReadOnly && scheduleId && (
          <>
            {showPublishedDiagnosticsToggle && (
              <Button type="button" variant="outline" onClick={onTogglePublishedDiagnostics} disabled={deleting}>
                {showPublishedDiagnostics ? "Скрыть пожелания" : "Показать пожелания"}
              </Button>
            )}
            <Button variant="outline" onClick={onOpenOwnerDialog} disabled={deleting}>
              Сменить ответственного
            </Button>
            {canViewPreferences && (
              <Button variant="outline" onClick={onOpenPreferences} disabled={deleting}>
                Пожелания сотрудников
              </Button>
            )}
            {isDraftSchedule(schedule.status) && (
              <Button variant="outline" onClick={onStartPreferenceCollection} disabled={lifecycleDisabled}>
                {lifecycleAction === "startPreferences" ? "Запуск…" : "Собрать пожелания"}
              </Button>
            )}
            {isCollectingPreferences(schedule.status) && (
              <Button variant="outline" onClick={onClosePreferenceCollection} disabled={lifecycleDisabled}>
                {lifecycleAction === "closePreferences" ? "Закрытие…" : "Закрыть сбор"}
              </Button>
            )}
            {canApplySchedulePreferences(schedule.status) && (
              <Button variant="outline" onClick={onOpenApplyPreferencesDialog} disabled={lifecycleDisabled}>
                {lifecycleAction === "applyPreferences" ? "Подготовка…" : applyPreferencesLabel}
              </Button>
            )}
            {canPublishSchedule(schedule.status) && (
              <Button variant="outline" onClick={onPublishSchedule} disabled={lifecycleDisabled}>
                {lifecycleAction === "publish" ? "Публикация…" : "Опубликовать"}
              </Button>
            )}
            {canEditContent && (
              <Button variant="outline" onClick={onEnterEditMode} disabled={deleting}>
                Редактировать
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onDelete}
              disabled={deleting}
              className={`border-red-200 text-red-600 hover:bg-red-50 ${deleting ? "cursor-wait opacity-60" : ""}`}
            >
              {deleting ? "Удаление…" : "Удалить"}
            </Button>
          </>
        )}

        {canManage && scheduleId && (
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => onToggleDownloadMenu(downloadMenuFor === scheduleId ? null : scheduleId)}
              disabled={Boolean(downloading)}
            >
              Скачать
            </Button>

            {downloadMenuFor === scheduleId && (
              <div className="border-subtle bg-surface absolute right-0 z-10 mt-2 w-36 rounded-xl border shadow-[var(--staffly-shadow)]">
                <button
                  className="text-default hover:bg-app block w-full px-3 py-2 text-left text-sm"
                  onClick={() => {
                    onDownloadXlsx(scheduleId);
                    onToggleDownloadMenu(null);
                  }}
                >
                  Скачать .xlsx
                </button>
                <button
                  className="text-default hover:bg-app block w-full px-3 py-2 text-left text-sm"
                  onClick={() => {
                    onDownloadJpg(scheduleId);
                    onToggleDownloadMenu(null);
                  }}
                >
                  Скачать .jpg
                </button>
              </div>
            )}
          </div>
        )}

        {!canManage && canCreateShiftRequest && (
          <>
            <Button variant="outline" onClick={onOpenReplacement}>
              Создать замену
            </Button>
            <Button variant="outline" onClick={onOpenSwap}>
              Создать обмен сменами
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ScheduleDetailHeader;

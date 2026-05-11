import React from "react";

import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import { formatDateFromIso } from "../../../shared/utils/date";
import type {
  SchedulePreferenceCellDto,
  SchedulePreferenceProgressResponse,
  SchedulePreferenceSubmissionDto,
  SchedulePreferenceSubmissionsResponse,
  SchedulePreferenceType,
} from "../api";
import { getScheduleStatusLabel } from "../utils/status";

type SchedulePreferenceManagerDialogProps = {
  open: boolean;
  loading: boolean;
  error: string | null;
  progress: SchedulePreferenceProgressResponse | null;
  submissions: SchedulePreferenceSubmissionsResponse | null;
  onClose: () => void;
  onReload: () => void;
};

const PREFERENCE_TYPE_LABELS: Record<SchedulePreferenceType, string> = {
  AVAILABLE: "Могу",
  UNAVAILABLE: "Не могу",
  PREFER_DAY_OFF: "Хочу выходной",
  PREFER_WORK: "Хочу работать",
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMemberName(displayName: string | null | undefined): string {
  return displayName?.trim() || "Сотрудник без имени";
}

function formatPosition(positionName: string | null | undefined): string {
  return positionName?.trim() || "Должность не указана";
}

function formatCellTime(cell: SchedulePreferenceCellDto): string {
  if (cell.fullDay) return "Весь день";
  if (cell.startTime && cell.endTime) return `${cell.startTime}–${cell.endTime}`;
  if (cell.startTime) return `с ${cell.startTime}`;
  if (cell.endTime) return `до ${cell.endTime}`;
  return "Интервал не указан";
}

function sortCells(cells: SchedulePreferenceCellDto[]): SchedulePreferenceCellDto[] {
  return [...cells].sort((a, b) => {
    const dayCompare = a.day.localeCompare(b.day);
    if (dayCompare !== 0) return dayCompare;
    return a.sortOrder - b.sortOrder;
  });
}

function SubmissionCard({ submission }: { submission: SchedulePreferenceSubmissionDto }) {
  const positionName = submission.positionName ?? submission.member.positionName;
  const cells = sortCells(submission.cells);

  return (
    <div className="border-subtle bg-surface rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-strong text-sm font-semibold">{formatMemberName(submission.member.displayName)}</div>
          <div className="text-muted text-xs">{formatPosition(positionName)}</div>
        </div>
        <div className="text-muted text-xs">
          {formatDateTime(submission.submittedAt)}
          {submission.revision > 0 && <> · ревизия {submission.revision}</>}
        </div>
      </div>

      {submission.comment && (
        <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {submission.comment}
        </div>
      )}

      {cells.length > 0 ? (
        <div className="mt-3 space-y-2">
          {cells.map((cell, index) => (
            <div
              key={`${cell.id ?? "new"}-${cell.day}-${cell.sortOrder}-${index}`}
              className="border-subtle bg-surface-muted rounded-xl border px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-default font-medium">{formatDateFromIso(cell.day)}</span>
                <span className="border-subtle bg-surface text-muted rounded-full border px-2 py-0.5 text-xs">
                  {PREFERENCE_TYPE_LABELS[cell.type]}
                </span>
                <span className="text-muted text-xs">{formatCellTime(cell)}</span>
              </div>
              {cell.note && <div className="text-muted mt-1 text-xs">{cell.note}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted mt-3 text-sm">Пожелания по дням не указаны.</div>
      )}
    </div>
  );
}

const SchedulePreferenceManagerDialog: React.FC<SchedulePreferenceManagerDialogProps> = ({
  open,
  loading,
  error,
  progress,
  submissions,
  onClose,
  onReload,
}) => {
  const metadata = progress ?? submissions;
  const description = metadata ? (
    <div className="space-y-1">
      <div>{metadata.title}</div>
      <div>
        Статус: {getScheduleStatusLabel(metadata.status)} · Дедлайн: {formatDateTime(metadata.preferenceDeadline)}
      </div>
    </div>
  ) : (
    "Прогресс и отправленные пожелания по графику."
  );

  const hasSubmissions = (submissions?.submissions.length ?? 0) > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Пожелания сотрудников"
      description={description}
      className="max-w-5xl"
      footer={
        <>
          <Button variant="outline" onClick={onReload} disabled={loading}>
            {loading ? "Обновление…" : "Обновить"}
          </Button>
          <Button onClick={onClose}>Закрыть</Button>
        </>
      }
    >
      <div className="space-y-4">
        {loading && !progress && !submissions && <div className="text-muted text-sm">Загрузка…</div>}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div>{error}</div>
            <Button variant="outline" onClick={onReload} disabled={loading} className="mt-3">
              Повторить
            </Button>
          </div>
        )}

        {progress && (
          <section className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border-subtle bg-surface-muted rounded-2xl border p-4">
                <div className="text-muted text-xs">Участников</div>
                <div className="text-strong mt-1 text-2xl font-semibold">{progress.totalParticipants}</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-xs text-emerald-700">Отправили</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-800">{progress.submittedCount}</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs text-amber-700">Не отправили</div>
                <div className="mt-1 text-2xl font-semibold text-amber-800">{progress.notSubmittedCount}</div>
              </div>
            </div>

            <div className="border-subtle overflow-hidden rounded-2xl border">
              {progress.participants.map((participant) => (
                <div
                  key={participant.memberId}
                  className="border-subtle grid gap-2 border-b p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="text-default text-sm font-medium">{formatMemberName(participant.displayName)}</div>
                    <div className="text-muted text-xs">{formatPosition(participant.positionName)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        participant.submitted
                          ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700"
                          : "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700"
                      }
                    >
                      {participant.submitted ? "Отправил" : "Не отправил"}
                    </span>
                    {participant.submittedAt && (
                      <span className="text-muted">{formatDateTime(participant.submittedAt)}</span>
                    )}
                    {participant.revision > 0 && <span className="text-muted">ревизия {participant.revision}</span>}
                    <span className="text-muted">ячеек: {participant.cellsCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div>
            <h3 className="text-strong text-base font-semibold">Отправленные пожелания</h3>
            <p className="text-muted text-sm">Просмотр без редактирования и применения к графику.</p>
          </div>

          {submissions && !hasSubmissions && (
            <div className="border-subtle bg-surface-muted text-muted rounded-2xl border p-4 text-sm">
              Пока никто не отправил пожелания
            </div>
          )}

          {submissions && hasSubmissions && (
            <div className="space-y-3">
              {submissions.submissions.map((submission) => (
                <SubmissionCard key={submission.submissionId} submission={submission} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
};

export default SchedulePreferenceManagerDialog;

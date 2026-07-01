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
  AVAILABLE: "Могу работать",
  UNAVAILABLE: "Не могу работать",
  PREFER_DAY_OFF: "Предпочитаю выходной",
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

type PreferenceSummary = {
  available: number;
  preferDayOff: number;
  unavailable: number;
};

type EmployeePreferenceRow = {
  key: string;
  displayName?: string | null;
  positionName?: string | null;
  submitted: boolean;
  submittedAt?: string | null;
  revision: number;
  cellsCount: number;
  submission?: SchedulePreferenceSubmissionDto;
};

function countPreferenceSummary(cells: SchedulePreferenceCellDto[]): PreferenceSummary {
  return cells.reduce<PreferenceSummary>(
    (summary, cell) => {
      if (cell.type === "AVAILABLE") summary.available += 1;
      if (cell.type === "PREFER_DAY_OFF") summary.preferDayOff += 1;
      if (cell.type === "UNAVAILABLE") summary.unavailable += 1;
      return summary;
    },
    { available: 0, preferDayOff: 0, unavailable: 0 },
  );
}

function formatPreferenceSummary(summary: PreferenceSummary): string {
  return `могу работать: ${summary.available}, предпочитаю выходной: ${summary.preferDayOff}, не могу работать: ${summary.unavailable}`;
}

function buildEmployeePreferenceRows(
  progress: SchedulePreferenceProgressResponse | null,
  submissions: SchedulePreferenceSubmissionsResponse | null,
): EmployeePreferenceRow[] {
  const submissionsByMemberId = new Map<number, SchedulePreferenceSubmissionDto>();

  submissions?.submissions.forEach((submission) => {
    submissionsByMemberId.set(submission.member.memberId, submission);
  });

  if (progress) {
    return progress.participants.map((participant) => {
      const submission = submissionsByMemberId.get(participant.memberId);
      const positionName = submission?.positionName ?? submission?.member.positionName ?? participant.positionName;

      return {
        key: `member-${participant.memberId}`,
        displayName: submission?.member.displayName ?? participant.displayName,
        positionName,
        submitted: participant.submitted,
        submittedAt: participant.submittedAt ?? submission?.submittedAt,
        revision: participant.revision || submission?.revision || 0,
        cellsCount: submission?.cells.length ?? participant.cellsCount,
        submission,
      };
    });
  }

  return (submissions?.submissions ?? []).map((submission) => ({
    key: `submission-${submission.submissionId}`,
    displayName: submission.member.displayName,
    positionName: submission.positionName ?? submission.member.positionName,
    submitted: true,
    submittedAt: submission.submittedAt,
    revision: submission.revision,
    cellsCount: submission.cells.length,
    submission,
  }));
}

function EmployeePreferenceAccordionRow({
  row,
  expanded,
  onToggle,
}: {
  row: EmployeePreferenceRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cells = sortCells(row.submission?.cells ?? []);
  const summary = countPreferenceSummary(cells);
  const statusClassName = row.submitted
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <div className="border-subtle bg-surface overflow-hidden rounded-2xl border">
      <button
        type="button"
        className="grid w-full gap-3 p-4 text-left transition hover:bg-[var(--staffly-control-hover)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-strong text-sm font-semibold">{formatMemberName(row.displayName)}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClassName}`}>
              {row.submitted ? "Отправлено" : "Не отправлено"}
            </span>
          </div>
          <div className="text-muted text-xs">{formatPosition(row.positionName)}</div>
          <div className="text-muted flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span>заполнено: {row.cellsCount}</span>
            <span>{formatPreferenceSummary(summary)}</span>
            {row.submittedAt && <span>отправлено: {formatDateTime(row.submittedAt)}</span>}
            {row.revision > 0 && <span>ревизия {row.revision}</span>}
          </div>
        </div>
        <div className="text-muted flex items-center justify-between gap-2 text-sm font-medium sm:justify-end">
          <span>{expanded ? "Свернуть" : "Развернуть"}</span>
          <span
            aria-hidden="true"
            className={`text-lg leading-none transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            ˅
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-subtle border-t p-4 pt-3">
          {row.submission?.comment && (
            <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              {row.submission.comment}
            </div>
          )}

          {!row.submitted && <div className="text-muted text-sm">Сотрудник ещё не отправил пожелания.</div>}

          {row.submitted && cells.length > 0 && (
            <div className="space-y-2">
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
          )}

          {row.submitted && cells.length === 0 && (
            <div className="text-muted text-sm">Пожелания по дням не указаны.</div>
          )}
        </div>
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

  const employeeRows = React.useMemo(() => buildEmployeePreferenceRows(progress, submissions), [progress, submissions]);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setExpandedRows(new Set());
  }, [open, metadata?.scheduleId]);

  const toggleRow = React.useCallback((rowKey: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }, []);

  const expandAll = React.useCallback(() => {
    setExpandedRows(new Set(employeeRows.map((row) => row.key)));
  }, [employeeRows]);

  const collapseAll = React.useCallback(() => {
    setExpandedRows(new Set());
  }, []);

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
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-strong text-base font-semibold">Сотрудники и пожелания</h3>
              <p className="text-muted text-sm">
                Все строки свернуты по умолчанию. Раскройте сотрудника, чтобы посмотреть дни.
              </p>
            </div>
            {employeeRows.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={expandAll}
                  disabled={expandedRows.size === employeeRows.length}
                >
                  Развернуть всех
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll} disabled={expandedRows.size === 0}>
                  Свернуть всех
                </Button>
              </div>
            )}
          </div>

          {(progress || submissions) && employeeRows.length === 0 && (
            <div className="border-subtle bg-surface-muted text-muted rounded-2xl border p-4 text-sm">
              Пока нет сотрудников или отправленных пожеланий
            </div>
          )}

          {employeeRows.length > 0 && (
            <div className="space-y-2">
              {employeeRows.map((row) => (
                <EmployeePreferenceAccordionRow
                  key={row.key}
                  row={row}
                  expanded={expandedRows.has(row.key)}
                  onToggle={() => toggleRow(row.key)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
};

export default SchedulePreferenceManagerDialog;

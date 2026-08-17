import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import Card from "../../../shared/ui/Card";
import type { ScheduleAuditLogDto } from "../types";

type ScheduleHistoryBlockProps = {
  history?: ScheduleAuditLogDto[] | null;
};

const ACTION_LABELS: Record<string, string> = {
  CREATED: "График создан",
  UPDATED: "График изменён",
  DELETED: "График удалён",
  OWNER_CHANGED: "Ответственный изменён",
  PREFERENCE_COLLECTION_STARTED: "Сбор пожеланий открыт",
  PREFERENCE_COLLECTION_CLOSED: "Сбор пожеланий закрыт",
  PREFERENCES_APPLIED: "Пожелания применены",
  AUTO_BUILD_APPLIED: "Автосборка применена",
  PUBLISHED: "График опубликован",
  SHIFT_REQUEST_CREATED: "Создана заявка на смену",
  SHIFT_REQUEST_APPROVED: "Заявка одобрена",
  SHIFT_REQUEST_REJECTED: "Заявка отклонена",
  SHIFT_REQUEST_AUTO_REJECTED: "Заявка автоотклонена",
};

function formatScheduleAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatDateTime(value: string): string {
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

function getCreatedAtTime(value: string): number {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function ScheduleHistoryEntry({ entry }: { entry: ScheduleAuditLogDto }) {
  const label = formatScheduleAuditAction(entry.action);
  const mainText = entry.details?.trim() || label;
  const actor = entry.actorDisplayName?.trim() || "Система";

  return (
    <div className="border-subtle rounded-2xl border px-3 py-2 text-sm">
      <div className="text-strong font-medium">{mainText}</div>
      {entry.details?.trim() && <div className="text-muted mt-1 text-xs">{label}</div>}
      <div className="text-muted mt-1 text-xs">
        {actor} · {formatDateTime(entry.createdAt)}
      </div>
    </div>
  );
}

const ScheduleHistoryBlock: React.FC<ScheduleHistoryBlockProps> = ({ history }) => {
  const [showFullHistory, setShowFullHistory] = React.useState(false);
  const entries = React.useMemo(
    () => [...(history ?? [])].sort((a, b) => getCreatedAtTime(b.createdAt) - getCreatedAtTime(a.createdAt)),
    [history],
  );

  if (entries.length === 0) {
    return null;
  }

  const visibleEntries = showFullHistory ? entries : entries.slice(0, 1);
  const canToggleHistory = entries.length > 1;

  return (
    <Card className="border-subtle">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-strong text-lg font-semibold">История изменений</h2>
        {canToggleHistory && (
          <button
            type="button"
            className="text-brand hover:text-brand-dark inline-flex items-center gap-1 text-sm font-medium"
            aria-expanded={showFullHistory}
            onClick={() => setShowFullHistory((value) => !value)}
          >
            {showFullHistory ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
            {showFullHistory ? "Скрыть историю" : "Показать всю историю"}
          </button>
        )}
      </div>
      <div className="mt-3 space-y-3">
        {visibleEntries.map((entry) => (
          <ScheduleHistoryEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </Card>
  );
};

export default ScheduleHistoryBlock;

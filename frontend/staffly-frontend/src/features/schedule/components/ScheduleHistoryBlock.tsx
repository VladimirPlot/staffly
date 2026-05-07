import React from "react";

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

const ScheduleHistoryBlock: React.FC<ScheduleHistoryBlockProps> = ({ history }) => {
  const entries = history ?? [];

  if (entries.length === 0) {
    return null;
  }

  return (
    <Card className="border-subtle">
      <details className="group" open>
        <summary className="text-strong cursor-pointer list-none text-lg font-semibold">История изменений</summary>
        <div className="mt-3 space-y-3">
          {entries.map((entry) => {
            const label = formatScheduleAuditAction(entry.action);
            const mainText = entry.details?.trim() || label;
            const actor = entry.actorDisplayName?.trim() || "Система";

            return (
              <div key={entry.id} className="border-subtle rounded-2xl border px-3 py-2 text-sm">
                <div className="text-strong font-medium">{mainText}</div>
                {entry.details?.trim() && <div className="text-muted mt-1 text-xs">{label}</div>}
                <div className="text-muted mt-1 text-xs">
                  {actor} · {formatDateTime(entry.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      </details>
    </Card>
  );
};

export default ScheduleHistoryBlock;

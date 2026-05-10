import React from "react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import { type ShiftRequestDto } from "../api";

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

type ShiftRequestsSectionProps = {
  canManage: boolean;
  loading: boolean;
  error: string | null;
  requests: ShiftRequestDto[];
  humanStatus: (status: ShiftRequestDto["status"]) => string;
  shiftDisplay: (memberId: number, day: string | null) => string;
  canCancelOwnRequest: (request: ShiftRequestDto) => boolean;
  onManagerDecision: (requestId: number, accept: boolean) => void;
  onCancel: (requestId: number) => void;
};

const ShiftRequestsSection: React.FC<ShiftRequestsSectionProps> = ({
  canManage,
  loading,
  error,
  requests,
  humanStatus,
  shiftDisplay,
  canCancelOwnRequest,
  onManagerDecision,
  onCancel,
}) => {
  return (
    <div className="space-y-3">
      <div className="text-strong text-lg font-semibold">
        {canManage ? "Заявки по этому графику" : "Мои заявки по этому графику"}
      </div>
      {loading && <Card>Заявки на смены загружаются…</Card>}
      {!loading && error && <Card className="border-red-200 bg-red-50 text-red-700">{error}</Card>}
      {!loading && !error && requests.length === 0 && <Card>Пока нет заявок по этому графику.</Card>}
      {!loading && !error && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((request) => {
            const decisionComment = request.decisionComment?.trim();
            const showDecisionInfo =
              request.status !== "PENDING_MANAGER" && Boolean(decisionComment || request.decidedAt);

            return (
              <Card key={request.id} className="border-subtle">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="text-default space-y-1 text-sm">
                    <div className="text-strong flex flex-wrap items-center gap-2 font-medium">
                      <span>{request.type === "REPLACEMENT" ? "Замена" : "Обмен сменами"}</span>
                      <span className="bg-app text-default rounded-full px-2 py-1 text-xs font-normal">
                        {humanStatus(request.status)}
                      </span>
                    </div>
                    <div className="text-muted text-xs">
                      {request.type === "REPLACEMENT" ? "От" : "Первый"}: {request.fromMember.displayName}
                      {request.dayFrom && <> • {shiftDisplay(request.fromMember.id, request.dayFrom)}</>}
                    </div>
                    <div className="text-muted text-xs">
                      {request.type === "REPLACEMENT" ? "Кому" : "Второй"}: {request.toMember.displayName}
                      {request.dayTo && <> • {shiftDisplay(request.toMember.id, request.dayTo)}</>}
                      {request.type === "REPLACEMENT" && request.dayFrom && !request.dayTo && (
                        <> • {shiftDisplay(request.toMember.id, request.dayFrom)}</>
                      )}
                    </div>
                    {request.reason && <div className="text-muted text-xs">Причина: {request.reason}</div>}
                    <div className="text-muted text-xs">Создано: {formatDateTime(request.createdAt)}</div>
                    {showDecisionInfo && (
                      <div className="border-subtle bg-app text-default rounded-2xl border px-3 py-2 text-xs">
                        {decisionComment && <div>Причина: {decisionComment}</div>}
                        {request.decidedAt && (
                          <div className={decisionComment ? "text-muted mt-1" : "text-muted"}>
                            Решено: {formatDateTime(request.decidedAt)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {((canManage && request.status === "PENDING_MANAGER") || canCancelOwnRequest(request)) && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      {canManage && request.status === "PENDING_MANAGER" && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => onManagerDecision(request.id, true)}
                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          >
                            Подтвердить
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => onManagerDecision(request.id, false)}
                            className="border-red-200 text-red-700 hover:bg-red-50"
                          >
                            Отказать
                          </Button>
                        </>
                      )}

                      {canCancelOwnRequest(request) && (
                        <Button
                          variant="outline"
                          onClick={() => onCancel(request.id)}
                          className="border-subtle text-default hover:bg-app"
                        >
                          Отменить заявку
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShiftRequestsSection;

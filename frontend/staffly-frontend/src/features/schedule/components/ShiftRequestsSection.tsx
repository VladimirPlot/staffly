import React from "react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import { type ShiftRequestDto } from "../api";

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
      <div className="text-lg font-semibold text-strong">
        {canManage ? "Заявки по этому графику" : "Мои заявки по этому графику"}
      </div>
      {loading && <Card>Заявки на смены загружаются…</Card>}
      {!loading && error && <Card className="border-red-200 bg-red-50 text-red-700">{error}</Card>}
      {!loading && !error && requests.length === 0 && <Card>Пока нет заявок по этому графику.</Card>}
      {!loading && !error && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card key={request.id} className="border-subtle">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1 text-sm text-default">
                  <div className="flex flex-wrap items-center gap-2 font-medium text-strong">
                    <span>{request.type === "REPLACEMENT" ? "Замена" : "Обмен сменами"}</span>
                    <span className="rounded-full bg-app px-2 py-1 text-xs font-normal text-default">
                      {humanStatus(request.status)}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    {request.type === "REPLACEMENT" ? "От" : "Первый"}: {request.fromMember.displayName}
                    {request.dayFrom && (
                      <>
                        {" "}• {shiftDisplay(request.fromMember.id, request.dayFrom)}
                      </>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {request.type === "REPLACEMENT" ? "Кому" : "Ворой"}: {request.toMember.displayName}
                    {request.dayTo && (
                      <>
                        {" "}• {shiftDisplay(request.toMember.id, request.dayTo)}
                      </>
                    )}
                    {request.type === "REPLACEMENT" && request.dayFrom && !request.dayTo && (
                      <>
                        {" "}• {shiftDisplay(request.toMember.id, request.dayFrom)}
                      </>
                    )}
                  </div>
                  {request.reason && (
                    <div className="text-xs text-muted">Причина: {request.reason}</div>
                  )}
                  <div className="text-xs text-muted">
                    Создано: {new Date(request.createdAt).toLocaleString("ru-RU")}
                  </div>
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
          ))}
        </div>
      )}
    </div>
  );
};

export default ShiftRequestsSection;

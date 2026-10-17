import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import useCommonSchedules from "../hooks/useCommonSchedules";
import type { ScheduleSummary } from "../../schedule/api";

import { formatScheduleDate, sortCommonScheduleCandidates } from "../utils";
import CommonScheduleDialog from "./CommonScheduleDialog";
import CommonScheduleView from "./CommonScheduleView";
import CommonScheduleDownload from "./CommonScheduleDownload";
import { getCommonSchedule } from "../api";

type Props = {
  restaurantId: number;
  canManage: boolean;
  schedules: ScheduleSummary[];
  timeZone: string;
  onViewingChange: (viewing: boolean) => void;
  onRefreshSources: () => Promise<void>;
};

export default function CommonSchedulesSection({
  restaurantId,
  canManage,
  schedules,
  timeZone,
  onViewingChange,
  onRefreshSources,
}: Props) {
  const {
    items,
    loading,
    error,
    selectedId,
    detail,
    refreshing,
    dialog,
    dialogError,
    saving,
    deleteTarget,
    deleting,
    refresh,
    back,
    open,
    closeDialog,
    requestDelete,
    cancelDelete,
    edit,
    save,
    remove,
  } = useCommonSchedules({ restaurantId, onViewingChange, onRefreshSources });
  return (
    <section className="space-y-4" aria-label="Общие графики">
      {error && (
        <Card>
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
          <Button variant="outline" className="mt-2" onClick={refresh}>
            Повторить загрузку
          </Button>
        </Card>
      )}
      {selectedId != null ? (
        detail ? (
          <CommonScheduleView
            schedule={detail}
            downloadControl={
              <CommonScheduleDownload loadSchedule={() => getCommonSchedule(restaurantId, detail.summary.id)} />
            }
            timeZone={timeZone}
            refreshing={refreshing}
            canManage={canManage}
            onEdit={() => edit(detail.summary)}
            onRefresh={refresh}
            onBack={back}
          />
        ) : (
          <Card>
            <Button variant="outline" onClick={back}>
              К общим графикам
            </Button>
            {refreshing && <p className="text-muted mt-3 text-sm">Загрузка общего графика…</p>}
          </Card>
        )
      ) : (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-strong text-lg font-semibold">Общие графики</h2>
            {canManage && (
              <Button variant="outline" onClick={() => edit(null)}>
                Создать общий график
              </Button>
            )}
          </div>
          {loading ? (
            <p className="text-muted text-sm">Загрузка…</p>
          ) : items.length === 0 ? (
            <p className="text-muted text-sm">
              {canManage
                ? "Объедините опубликованные графики для просмотра состава всей команды."
                : "Нет доступных общих графиков."}
            </p>
          ) : (
            sortCommonScheduleCandidates(items).map((item) => (
              <div
                key={item.id}
                className="border-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <h3 className="text-strong font-medium break-words">{item.title}</h3>
                  <p className="text-muted text-sm">
                    {formatScheduleDate(item.startDate)} — {formatScheduleDate(item.endDate)} · Графиков:{" "}
                    {item.scheduleIds.length}
                  </p>
                  {canManage && (
                    <p className="text-muted text-xs">
                      {item.visibleToPositions ? "Виден сотрудникам выбранных должностей" : "Только Manager+"}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => open(item.id)}>
                    Открыть
                  </Button>
                  <CommonScheduleDownload loadSchedule={() => getCommonSchedule(restaurantId, item.id)} />
                  {canManage && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => edit(item)}>
                        Настройки
                      </Button>
                      <Button size="sm" variant="danger-ghost" onClick={() => requestDelete(item)}>
                        Удалить
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>
      )}
      {dialog && (
        <CommonScheduleDialog
          initial={dialog.initial}
          schedules={schedules}
          saving={saving}
          error={dialogError}
          onClose={closeDialog}
          onSave={(payload) => void save(payload)}
        />
      )}
      <ConfirmDialog
        open={deleteTarget != null}
        title="Удалить общий график?"
        tone="danger"
        description={`Будет удалён общий график «${deleteTarget?.title ?? ""}». Исходные графики сохранятся.`}
        confirmText="Удалить"
        confirming={deleting}
        onCancel={cancelDelete}
        onConfirm={() => void remove()}
      />
    </section>
  );
}

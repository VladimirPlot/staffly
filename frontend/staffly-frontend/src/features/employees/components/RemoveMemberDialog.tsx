import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import type { EmployeeRemovalImpactPlan, EmployeeRemovalScheduleImpact } from "../api";

function consequences(schedule: EmployeeRemovalScheduleImpact, isSelf: boolean): string[] {
  const lines: string[] = [];
  if (schedule.participationWillBeRemoved) {
    lines.push(
      schedule.scheduleStatus === "COLLECTING_PREFERENCES"
        ? isSelf
          ? "Вы больше не будете участвовать в сборе пожеланий."
          : "Сотрудник больше не будет участвовать в сборе пожеланий."
        : isSelf
          ? "Вы будете исключены из состава этого графика."
          : "Сотрудник будет исключён из состава этого графика.",
    );
  }
  if (schedule.preferenceDataWillBeDeleted) {
    lines.push(
      isSelf
        ? "Ваши отправленные пожелания будут удалены."
        : schedule.scheduleStatus === "PREFERENCES_CLOSED"
          ? "Его ранее отправленные пожелания будут удалены."
          : "Его отправленные пожелания будут удалены.",
    );
  }
  if (schedule.progressDenominatorWillChange)
    lines.push(
      isSelf
        ? "После вашего выхода прогресс сбора пожеланий будет пересчитан."
        : "Прогресс сбора пожеланий будет пересчитан.",
    );
  if (schedule.appliedPreferenceDraftWillBeInvalidated) {
    lines.push(
      isSelf
        ? "После вашего выхода текущий результат автосборки станет неактуальным. Пожелания остальных сотрудников сохранятся, но график потребуется собрать заново."
        : "График был собран по пожеланиям сотрудников. После удаления сотрудника текущий результат автосборки станет неактуальным. Пожелания остальных сотрудников сохранятся, но график потребуется собрать заново.",
    );
  }
  if (schedule.activeDraftRowWillBeRemoved)
    lines.push(isSelf ? "Вы будете удалены из черновика графика." : "Сотрудник будет удалён из черновика графика.");
  if (schedule.publishedRowBecomesHistorical) {
    lines.push(
      isSelf
        ? "Ваша строка останется в опубликованном графике как история."
        : "Строка сотрудника останется в опубликованном графике как история.",
    );
  }
  const shifts = schedule.publishedShiftImpact;
  if (shifts?.elapsedPreserved)
    lines.push(`${isSelf ? "Ваши прошедшие смены" : "Прошедшие смены"} сохранятся: ${shifts.elapsedPreserved}.`);
  if (shifts?.currentPreserved)
    lines.push(`${isSelf ? "Ваши текущие смены" : "Текущие смены"} сохранятся: ${shifts.currentPreserved}.`);
  if (shifts?.futureToCancel)
    lines.push(`${isSelf ? "Ваши будущие смены" : "Будущие смены"} будут отменены: ${shifts.futureToCancel}.`);
  if (shifts?.legacyUnstructuredPreserved) {
    lines.push(
      `Некоторые старые смены нельзя однозначно определить по времени. Они будут сохранены: ${shifts.legacyUnstructuredPreserved}.`,
    );
  }
  return lines;
}

function summary(plan: EmployeeRemovalImpactPlan, isSelf: boolean): string[] {
  const schedules = plan.scheduleImpacts;
  const preferenceCount = schedules.filter((item) => item.preferenceDataWillBeDeleted).length;
  const rebuildCount = schedules.filter((item) => item.appliedPreferenceDraftWillBeInvalidated).length;
  const futureCount = schedules.reduce((total, item) => total + (item.publishedShiftImpact?.futureToCancel ?? 0), 0);
  const historicalCount = schedules.filter((item) => item.publishedRowBecomesHistorical).length;
  return [
    isSelf ? "Вы покинете ресторан." : "Сотрудник будет удалён из ресторана.",
    preferenceCount
      ? `${isSelf ? "Ваши отправленные пожелания" : "Отправленные пожелания"} будут удалены в графиках: ${preferenceCount}.`
      : null,
    rebuildCount ? `Результаты автосборки потребуется собрать заново: ${rebuildCount}.` : null,
    futureCount ? `${isSelf ? "Ваши будущие смены" : "Будущие смены"} будут отменены: ${futureCount}.` : null,
    historicalCount ? "История опубликованных графиков сохранится." : null,
  ].filter((line): line is string => Boolean(line));
}

type Props = {
  open: boolean;
  plan: EmployeeRemovalImpactPlan | null;
  loading: boolean;
  confirming: boolean;
  error: string | null;
  notice: string | null;
  isSelf: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function RemoveMemberDialog({
  open,
  plan,
  loading,
  confirming,
  error,
  notice,
  isSelf,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      open={open}
      title={isSelf ? "Покинуть ресторан" : "Удаление сотрудника"}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading || confirming}>
            Отмена
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={confirming} disabled={loading || !plan}>
            {isSelf ? "Покинуть ресторан" : "Удалить сотрудника"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-2">
        {loading && <p className="text-muted text-sm">Проверяем связанные графики…</p>}
        {notice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{notice}</div>
        )}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {plan && (
          <>
            <div className="space-y-1">
              <p className="text-strong font-medium">
                {isSelf ? "Вы собираетесь покинуть ресторан." : `Вы удаляете ${plan.employee.name} из ресторана.`}
              </p>
              {plan.employee.currentPosition && (
                <p className="text-muted text-sm">Текущая должность: {plan.employee.currentPosition.name}</p>
              )}
              <p className="text-muted text-sm">
                {isSelf
                  ? "Перед выходом из ресторана проверьте, что произойдёт с вашими текущими графиками и пожеланиями."
                  : "Перед удалением Staffly обновит связанные графики. Проверьте последствия."}
              </p>
            </div>
            {plan.scheduleImpacts.length === 0 ? (
              <div className="border-subtle bg-surface-muted rounded-xl border p-4 text-sm">
                {isSelf
                  ? "Вы не участвуете в текущих графиках. После подтверждения вы покинете ресторан."
                  : "Сотрудник не участвует в текущих графиках. После подтверждения он будет удалён из ресторана."}
              </div>
            ) : (
              <div className="space-y-3">
                {plan.scheduleImpacts.map((schedule) => (
                  <section key={schedule.scheduleId} className="border-subtle rounded-2xl border p-4">
                    <h3 className="text-strong font-semibold">{schedule.scheduleTitle}</h3>
                    <ul className="text-default mt-2 list-disc space-y-1 pl-5 text-sm">
                      {consequences(schedule, isSelf).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
            <section className="border-subtle bg-surface-muted rounded-xl border p-4">
              <h3 className="text-strong text-sm font-semibold">{isSelf ? "После выхода:" : "После удаления:"}</h3>
              <ul className="text-default mt-2 list-disc space-y-1 pl-5 text-sm">
                {summary(plan, isSelf).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
            {isSelf && (
              <p className="text-sm font-medium text-red-700">
                После подтверждения вы покинете ресторан и потеряете доступ к нему.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

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
  if (schedule.autoBuildWillBecomeStale) {
    lines.push(
      isSelf
        ? "После вашего выхода результат автосборки станет неактуальным. Вы сможете проверить текущий график вручную или запустить автосборку повторно."
        : "После изменения состава сотрудников результат автосборки станет неактуальным. Текущий график можно проверить вручную или запустить автосборку повторно.",
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
  const rebuildCount = schedules.filter((item) => item.autoBuildWillBecomeStale).length;
  const futureCount = schedules.reduce((total, item) => total + (item.publishedShiftImpact?.futureToCancel ?? 0), 0);
  const historicalCount = schedules.filter((item) => item.publishedRowBecomesHistorical).length;
  return [
    isSelf ? "Вы покинете ресторан." : "Сотрудник будет удалён из ресторана.",
    preferenceCount
      ? `${isSelf ? "Ваши отправленные пожелания" : "Отправленные пожелания"} будут удалены в графиках: ${preferenceCount}.`
      : null,
    rebuildCount ? `Результат автосборки устареет в графиках: ${rebuildCount}. Их можно проверить вручную или пересобрать.` : null,
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
  taskSelections: Record<string, number | null>;
  onTaskSelection: (key: string, memberId: number) => void;
  ownershipSelections: Record<string, number | null>;
  onOwnershipSelection: (key: string, userId: number) => void;
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
  taskSelections,
  onTaskSelection,
  ownershipSelections,
  onOwnershipSelection,
}: Props) {
  const missingTaskDecision = Boolean(plan && [
    ...(plan.mode === "FORCED" ? plan.taskImpact.assigneeResponsibilities.map((task) => `assignee:${task.taskId}`) : []),
    ...plan.taskImpact.setterResponsibilities.map((task) => `setter:${task.taskId}`),
  ].some((key) => taskSelections[key] == null));
  const missingOwnershipDecision = Boolean(plan && [
    ...plan.scheduleOwnership.requiredTransfers.map((item) => `schedule:${item.resourceId}`),
    ...plan.certificationOwnership.requiredTransfers.map((item) => `certification:${item.resourceId}`),
  ].some((key) => ownershipSelections[key] == null));
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
          <Button variant="danger" onClick={onConfirm} isLoading={confirming} disabled={loading || !plan || missingTaskDecision || missingOwnershipDecision}>
            {isSelf ? "Покинуть ресторан" : "Исключить"}
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
            {([[plan.scheduleOwnership, "schedule", "Графики"] as const,
                [plan.certificationOwnership, "certification", "Аттестации"] as const] as const).map(([impact, kind, title]) =>
              impact.requiredTransfers.length > 0 && <section key={kind} className="border-subtle rounded-2xl border p-4">
                <h3 className="text-strong font-semibold">{title}</h3>
                {impact.requiredTransfers.map((item) => {
                  const key = `${kind}:${item.resourceId}`;
                  return <label key={key} className="mt-3 block text-sm">
                    <span className="mb-1 block">{item.title} — новый ответственный</span>
                    {item.candidates.length === 0 ? <span className="text-red-700">Нет доступных сотрудников для передачи ответственности.</span> :
                      <select className="border-subtle w-full rounded-lg border p-2" value={ownershipSelections[key] ?? ""}
                        onChange={(event) => onOwnershipSelection(key, Number(event.target.value))}>
                        <option value="" disabled>Выберите сотрудника</option>
                        {item.candidates.map((candidate) => <option key={candidate.memberId} value={candidate.userId}>{candidate.name}</option>)}
                      </select>}
                  </label>;
                })}
              </section>)}
            {(plan.taskImpact.assigneeResponsibilities.length > 0 || plan.taskImpact.setterResponsibilities.length > 0) && (
              <section className="border-subtle rounded-2xl border p-4">
                <h3 className="text-strong font-semibold">Задачи</h3>
                {plan.mode === "SELF_LEAVE" && plan.taskImpact.assigneeResponsibilities.length > 0 && (
                  <p className="text-muted mt-2 text-sm">Ваши активные задачи останутся без исполнителя.</p>
                )}
                {[...(plan.mode === "FORCED" ? plan.taskImpact.assigneeResponsibilities.map((task) => ({ task, kind: "assignee" })) : []),
                  ...plan.taskImpact.setterResponsibilities.map((task) => ({ task, kind: "setter" }))].map(({ task, kind }) => {
                    const key = `${kind}:${task.taskId}`;
                    return <label key={key} className="mt-3 block text-sm">
                      <span className="mb-1 block">{task.title} — новый {kind === "setter" ? "постановщик" : "исполнитель"}</span>
                      <select className="border-subtle w-full rounded-lg border p-2" value={taskSelections[key] ?? ""}
                        onChange={(event) => onTaskSelection(key, Number(event.target.value))}>
                        <option value="" disabled>Выберите сотрудника</option>
                        {task.candidates.map((candidate) => <option key={candidate.memberId} value={candidate.memberId}>
                          {candidate.name}{candidate.position ? ` — ${candidate.position}` : ""}
                        </option>)}
                      </select>
                    </label>;
                  })}
              </section>
            )}
            {(plan.checklistImpact.affectedCount > 0 || plan.reminderImpact.affectedCount > 0) && (
              <section className="border-subtle rounded-2xl border p-4">
                <h3 className="text-strong font-semibold">Автоматические последствия</h3>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {plan.checklistImpact.affectedCount > 0 && <li>Будут освобождены бронирования чек-листов: {plan.checklistImpact.affectedCount}.</li>}
                  {plan.reminderImpact.affectedCount > 0 && <li>Будут остановлены личные напоминания: {plan.reminderImpact.affectedCount}.</li>}
                </ul>
              </section>
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

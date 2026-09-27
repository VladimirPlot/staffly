import Modal from "../../../shared/ui/Modal";
import Button from "../../../shared/ui/Button";
import SelectField from "../../../shared/ui/SelectField";
import type { PositionDto } from "../../dictionaries/api";
import type { NewPositionOpportunity, OldPositionImpact, PositionChangeAction, PositionChangeImpactPlan } from "../api";
import type { PositionDecision } from "../hooks/useMemberEditPosition";
import {
  formatInstantInTimeZone,
  instantToRestaurantLocalDateTime,
  restaurantLocalDateTimeToInstant,
} from "../../schedule/utils/date";

const labels: Record<PositionChangeAction, string> = {
  ADD_TO_COLLECTION: "Добавить в сбор",
  DO_NOT_ADD: "Не добавлять",
  CHANGE_POSITION_AND_REOPEN_COLLECTION: "Сменить должность и переоткрыть сбор",
  CHANGE_POSITION_WITHOUT_ADDING_TO_THIS_SCHEDULE: "Сменить должность без добавления",
  REOPEN_AND_REBUILD_PREFERENCE_FLOW: "Переоткрыть сбор и собрать график повторно",
  INFORMATION_ONLY: "Не добавлять автоматически",
};
const status: Record<string, string> = {
  COLLECTING_PREFERENCES: "идёт сбор пожеланий",
  PREFERENCES_CLOSED: "сбор пожеланий завершён",
  DRAFT_FROM_PREFERENCES: "собран по пожеланиям",
  DRAFT: "черновик",
  PUBLISHED: "опубликован",
};
const reopen = (a?: PositionChangeAction) =>
  a === "CHANGE_POSITION_AND_REOPEN_COLLECTION" || a === "REOPEN_AND_REBUILD_PREFERENCE_FLOW";
const isInformationOnly = (item: NewPositionOpportunity) =>
  item.scheduleStatus === "DRAFT" ||
  item.scheduleStatus === "PUBLISHED" ||
  (item.allowedActions.length === 1 && item.allowedActions[0] === "INFORMATION_ONLY");

const eligibilityMessages = {
  MISSING_PREFERENCE_MODE: "Для этого сбора не определён режим пожеланий. Добавить сотрудника в сбор сейчас нельзя.",
  MISSING_FROZEN_SHIFT_OPTIONS_FOR_POSITION:
    "Для новой должности нет сохранённых вариантов смен этого сбора. Добавить сотрудника в сбор с выбором времени сейчас нельзя.",
} as const;

function OldConsequences({ impact, position }: { impact: OldPositionImpact; position: string }) {
  const p = impact.publishedShiftImpact;
  const items: string[] = [];
  if (impact.participationWillBeRemoved) items.push(`сотрудник перестанет участвовать в сборе как ${position}`);
  if (impact.preferenceDataWillBeDeleted) items.push("отправленные пожелания сотрудника будут удалены");
  if (impact.progressDenominatorWillChange) items.push("прогресс сбора будет пересчитан");
  if (impact.appliedDraftWillBeInvalidated) {
    items.push("текущий результат автосборки станет неактуальным", "график можно будет собрать повторно");
  }
  if (impact.activeRowWillBeRemoved) items.push("сотрудник будет удалён из черновика");
  if (impact.publishedRowBecomesHistorical) items.push("данные сотрудника останутся в истории опубликованного графика");
  if ((p?.elapsedPreserved ?? 0) > 0) items.push(`${p!.elapsedPreserved} прошедших смен будут сохранены`);
  if ((p?.currentPreserved ?? 0) > 0) items.push(`${p!.currentPreserved} текущих смен будут сохранены`);
  if ((p?.futureToCancel ?? 0) > 0) items.push(`${p!.futureToCancel} будущих смен будут отменены`);
  return (
    <div className="border-subtle rounded-xl border p-3">
      <b>
        График «{impact.scheduleTitle}» — {status[impact.scheduleStatus] ?? "текущий график"}
      </b>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {(p?.legacyUnstructuredPreserved ?? 0) > 0 && (
        <p className="mt-2 text-sm text-amber-700">
          Некоторые старые смены нельзя автоматически определить по времени — они будут сохранены.
        </p>
      )}
    </div>
  );
}

function Opportunity({
  item,
  decision,
  change,
  restaurantTimeZone,
}: {
  item: NewPositionOpportunity;
  decision?: PositionDecision;
  change: (d: PositionDecision) => void;
  restaurantTimeZone: string;
}) {
  const informational = isInformationOnly(item);
  return (
    <div className="border-subtle rounded-xl border p-3">
      <b>
        График «{item.scheduleTitle}» — {status[item.scheduleStatus]}
      </b>
      {item.currentPreferenceDeadline && (
        <p className="mt-1 text-sm">
          Текущий срок: {formatInstantInTimeZone(item.currentPreferenceDeadline, restaurantTimeZone)}
        </p>
      )}
      {item.lessThanSixHoursRemain && (
        <p className="mt-2 rounded bg-amber-100 p-2 text-sm font-semibold text-amber-900">
          До окончания сбора осталось менее 6 часов.
        </p>
      )}
      {informational && (
        <p className="mt-2 text-sm">
          {item.scheduleStatus === "DRAFT"
            ? "Для новой должности существует черновик графика. Сотрудник не будет добавлен автоматически."
            : "Для новой должности уже есть опубликованный график. Сотрудник не будет добавлен автоматически. При необходимости его можно добавить отдельно в графике."}
        </p>
      )}
      {item.eligibilityProblems.map((problem) => (
        <p key={problem} className="mt-2 rounded bg-amber-100 p-2 text-sm text-amber-900">
          {eligibilityMessages[problem]}
        </p>
      ))}
      <div className="mt-2 space-y-2">
        {!informational &&
          item.allowedActions.map((action) => (
            <label key={action} className="flex cursor-pointer gap-2 text-sm">
              <input
                type="radio"
                name={`schedule-${item.scheduleId}`}
                checked={decision?.action === action}
                onChange={() => change({ action, newDeadline: "" })}
              />
              <span>{labels[action]}</span>
            </label>
          ))}
      </div>
      {reopen(decision?.action) && (
        <>
          <p className="mt-2 text-sm">
            Сбор пожеланий откроется повторно. Пожелания остальных сотрудников сохранятся и снова станут доступны для
            изменения. Сотрудник сможет отправить пожелания уже для новой должности.
            {item.scheduleStatus === "DRAFT_FROM_PREFERENCES" ? " Текущий результат нужно будет собрать повторно." : ""}
          </p>
          <label className="mt-2 block text-sm">
            Новый срок
            <input
              className="border-subtle bg-surface mt-1 block w-full rounded-lg border p-2"
              type="datetime-local"
              min={instantToRestaurantLocalDateTime(new Date(Date.now() + 60_000), restaurantTimeZone) ?? undefined}
              value={decision?.newDeadline ?? ""}
              onChange={(e) => change({ action: decision!.action, newDeadline: e.target.value })}
            />
          </label>
        </>
      )}
      {decision?.action === "ADD_TO_COLLECTION" && item.currentPreferenceDeadline && (
        <label className="mt-2 block text-sm">
          Продлить срок (необязательно)
          <input
            className="border-subtle bg-surface mt-1 block w-full rounded-lg border p-2"
            type="datetime-local"
            min={instantToRestaurantLocalDateTime(item.currentPreferenceDeadline, restaurantTimeZone) ?? undefined}
            value={decision.newDeadline}
            onChange={(event) => change({ action: decision.action, newDeadline: event.target.value })}
          />
          <span className="text-muted">Текущий срок нельзя сократить.</span>
        </label>
      )}
      {decision?.action === "DO_NOT_ADD" && item.scheduleStatus === "DRAFT_FROM_PREFERENCES" && (
        <p className="mt-2 text-sm">
          Сотрудник не будет добавлен в график для новой должности. Текущий результат автосборки станет неактуальным.
          Пожелания остальных сотрудников сохранятся, и график можно будет собрать повторно.
        </p>
      )}
    </div>
  );
}

export default function EditMemberPositionModal(props: {
  open: boolean;
  loading: boolean;
  positionsError: string | null;
  options: PositionDto[];
  value: number | null;
  plan: PositionChangeImpactPlan | null;
  decisions: Record<number, PositionDecision>;
  saving: boolean;
  loadingImpact: boolean;
  error: string | null;
  onClose: () => void;
  onPreview: () => void;
  onApply: () => void;
  onChangeValue: (v: number | null) => void;
  onDecision: (id: number, d: PositionDecision) => void;
  restaurantTimeZone: string;
}) {
  const { plan } = props;
  const valid =
    Boolean(plan) &&
    plan!.newPositionOpportunities.every((o) => {
      if (isInformationOnly(o)) return true;
      const d = props.decisions[o.scheduleId];
      const deadlineInstant = d?.newDeadline
        ? restaurantLocalDateTimeToInstant(d.newDeadline, props.restaurantTimeZone)
        : null;
      if (!d || (reopen(d.action) && (!deadlineInstant || new Date(deadlineInstant).getTime() <= Date.now())))
        return false;
      if (
        d.action === "ADD_TO_COLLECTION" &&
        d.newDeadline &&
        o.currentPreferenceDeadline &&
        (!deadlineInstant || new Date(deadlineInstant).getTime() < new Date(o.currentPreferenceDeadline).getTime())
      )
        return false;
      return true;
    });
  const cancelled =
    plan?.oldPositionImpacts.reduce((n, i) => n + (i.publishedShiftImpact?.futureToCancel ?? 0), 0) ?? 0;
  return (
    <Modal
      open={props.open}
      title={plan ? "Смена должности" : "Редактировать должность"}
      description={
        plan
          ? `${plan.employee.name}: ${plan.employee.oldPosition.name} → ${plan.employee.newPosition.name}`
          : "Выберите новую должность. Изменения произойдут только после итогового подтверждения."
      }
      onClose={props.onClose}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose} disabled={props.saving}>
            Отмена
          </Button>
          {plan ? (
            <Button onClick={props.onApply} disabled={!valid || props.saving} isLoading={props.saving}>
              Сменить должность
            </Button>
          ) : (
            <Button
              onClick={props.onPreview}
              disabled={!props.value || props.loadingImpact}
              isLoading={props.loadingImpact}
            >
              Продолжить
            </Button>
          )}
        </>
      }
    >
      {!plan ? (
        <SelectField
          label="Должность"
          value={props.value ?? ""}
          onChange={(e) => props.onChangeValue(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Выберите должность</option>
          {props.options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
      ) : (
        <div className="space-y-5">
          <p className="text-sm">
            Смена должности может повлиять на текущие графики и сборы пожеланий сотрудника. Проверьте изменения перед
            применением.
          </p>
          <section>
            <h3 className="mb-2 font-semibold">Что произойдёт с текущими графиками</h3>
            <div className="space-y-2">
              {plan.oldPositionImpacts.map((i) => (
                <OldConsequences key={i.scheduleId} impact={i} position={plan.employee.oldPosition.name} />
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-2 font-semibold">Графики для новой должности</h3>
            <div className="space-y-2">
              {plan.newPositionOpportunities.map((o) => (
                <Opportunity
                  key={o.scheduleId}
                  item={o}
                  decision={props.decisions[o.scheduleId]}
                  change={(d) => props.onDecision(o.scheduleId, d)}
                  restaurantTimeZone={props.restaurantTimeZone}
                />
              ))}
            </div>
          </section>
          <section className="bg-subtle rounded-xl p-3 text-sm">
            <b>После применения:</b>
            <ul className="mt-1 list-disc pl-5">
              <li>
                должность: {plan.employee.oldPosition.name} → {plan.employee.newPosition.name}
              </li>
              <li>
                пожелания сотрудника будут удалены из{" "}
                {plan.oldPositionImpacts.filter((i) => i.preferenceDataWillBeDeleted).length} графиков
              </li>
              {cancelled > 0 && <li>{cancelled} будущих смен будут отменены</li>}
              {plan.newPositionOpportunities
                .filter((o) => reopen(props.decisions[o.scheduleId]?.action))
                .map((o) => {
                  const decision = props.decisions[o.scheduleId];
                  const deadline = restaurantLocalDateTimeToInstant(decision.newDeadline, props.restaurantTimeZone);
                  return (
                    <li key={`reopen-${o.scheduleId}`}>
                      График «{o.scheduleTitle}»: сбор пожеланий будет открыт повторно до{" "}
                      {deadline ? formatInstantInTimeZone(deadline, props.restaurantTimeZone) : "выбранного срока"}
                      {decision.action === "REOPEN_AND_REBUILD_PREFERENCE_FLOW"
                        ? "; текущий результат автосборки станет неактуальным и потребует новой сборки"
                        : ""}
                    </li>
                  );
                })}
              {plan.newPositionOpportunities
                .filter(
                  (o) =>
                    props.decisions[o.scheduleId] &&
                    ["DO_NOT_ADD", "CHANGE_POSITION_WITHOUT_ADDING_TO_THIS_SCHEDULE", "INFORMATION_ONLY"].includes(
                      props.decisions[o.scheduleId].action,
                    ),
                )
                .map((o) => (
                  <li key={o.scheduleId}>в график «{o.scheduleTitle}» сотрудник добавлен не будет</li>
                ))}
            </ul>
          </section>
        </div>
      )}
      {(props.positionsError || props.error) && (
        <div className="mt-3 text-sm text-red-600">{props.positionsError || props.error}</div>
      )}
    </Modal>
  );
}

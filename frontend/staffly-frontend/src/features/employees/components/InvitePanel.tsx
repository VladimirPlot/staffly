import SelectField from "../../../shared/ui/SelectField";
import Button from "../../../shared/ui/Button";
import type { CountryCode } from "libphonenumber-js";
import type { PositionDto } from "../../dictionaries/api";
import { ROLE_LABEL } from "../utils/memberUtils";
import LazyPhoneInputField from "../../../shared/ui/LazyPhoneInputField";
import type {
  InvitationImpactPlan,
  InvitationIntentAction,
  InvitationScheduleOpportunity,
} from "../../invitations/api";
import { formatInstantInTimeZone, instantToRestaurantLocalDateTime } from "../../schedule/utils/date";

type InvitePanelProps = {
  open: boolean;
  inviteDone: boolean;
  phone: string | undefined;
  phoneCountry?: CountryCode;
  phoneCountryLocked?: boolean;
  phoneError?: string;
  positions: PositionDto[];
  loadingPositions: boolean;
  positionId: number | null;
  error: string | null;
  impact: InvitationImpactPlan | null;
  decisions: Record<number, InvitationIntentAction>;
  deadlines: Record<number, string>;
  restaurantTimeZone: string;
  submitting: boolean;
  isSubmitDisabled: boolean;
  isConfirmDisabled: boolean;
  onChangePhone: (value: string | undefined) => void;
  onChangePhoneCountry: (country: CountryCode, meta?: { manual: boolean; locked: boolean }) => void;
  onChangePositionId: (positionId: number | null) => void;
  onSubmit: () => void;
  onConfirm: () => void;
  onBack: () => void;
  onChangeDecision: (scheduleId: number, action: InvitationIntentAction) => void;
  onChangeDeadline: (scheduleId: number, value: string) => void;
  onCancel: () => void;
  onResetDone: () => void;
};

export default function InvitePanel({
  open,
  inviteDone,
  phone,
  phoneCountry,
  phoneCountryLocked,
  phoneError,
  positions,
  loadingPositions,
  positionId,
  error,
  impact,
  decisions,
  deadlines,
  restaurantTimeZone,
  submitting,
  isSubmitDisabled,
  isConfirmDisabled,
  onChangePhone,
  onChangePhoneCountry,
  onChangePositionId,
  onSubmit,
  onConfirm,
  onBack,
  onChangeDecision,
  onChangeDeadline,
  onCancel,
  onResetDone,
}: InvitePanelProps) {
  if (!open) return null;

  return (
    <div className="border-subtle bg-app mb-5 rounded-2xl border p-4">
      {inviteDone ? (
        <div className="space-y-4">
          <div className="text-emerald-700">
            Приглашение отправлено! Пользователь увидит его в разделе «Мои приглашения».
          </div>
          <div className="flex gap-2">
            <Button onClick={onResetDone}>Отправить ещё</Button>
            <Button variant="outline" onClick={onCancel}>
              Готово
            </Button>
          </div>
        </div>
      ) : impact ? (
        <div className="grid gap-4">
          <div>
            <div className="text-strong font-medium">Влияние приглашения на графики</div>
            <div className="text-muted mt-1 text-sm">
              {impact.candidate.phone} · {impact.candidate.targetPositionName}
            </div>
          </div>

          {impact.scheduleOpportunities.length === 0 ? (
            <div className="border-subtle text-muted rounded-xl border p-3 text-sm">
              Для этой должности нет актуальных графиков. Приглашение можно отправить без дополнительных решений.
            </div>
          ) : (
            impact.scheduleOpportunities.map((item) => (
              <ScheduleImpactCard
                key={item.scheduleId}
                item={item}
                action={decisions[item.scheduleId]}
                deadline={deadlines[item.scheduleId] ?? ""}
                timeZone={restaurantTimeZone}
                onAction={(action) => onChangeDecision(item.scheduleId, action)}
                onDeadline={(value) => onChangeDeadline(item.scheduleId, value)}
              />
            ))
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={isConfirmDisabled} onClick={onConfirm}>
              {submitting ? "Отправляем…" : "Отправить приглашение"}
            </Button>
            <Button variant="outline" disabled={submitting} onClick={onBack}>
              Назад
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <LazyPhoneInputField
            label="Телефон сотрудника"
            autoComplete="tel"
            value={phone}
            onChange={onChangePhone}
            country={phoneCountry}
            countryLocked={phoneCountryLocked}
            onCountryChange={onChangePhoneCountry}
            error={phoneError}
            disabled={submitting}
          />

          <SelectField
            label="Должность"
            value={positionId ?? ""}
            onChange={(event) => onChangePositionId(event.target.value ? Number(event.target.value) : null)}
          >
            {loadingPositions ? (
              <option value="">Загрузка…</option>
            ) : positions.length === 0 ? (
              <option value="">Нет подходящих должностей</option>
            ) : (
              positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name} ({ROLE_LABEL[position.level]})
                </option>
              ))
            )}
          </SelectField>

          {error && error !== phoneError && <div className="text-sm text-red-600">{error}</div>}

          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button disabled={isSubmitDisabled} onClick={onSubmit}>
              {submitting ? "Проверяем…" : "Продолжить"}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Отмена
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const ACTION_LABEL: Record<InvitationIntentAction, string> = {
  ADD_TO_COLLECTION: "Добавить в сбор после принятия",
  DO_NOT_ADD: "Не добавлять",
  ADD_AND_REOPEN_COLLECTION: "Добавить и переоткрыть сбор",
  ADD_AND_REOPEN_FOR_REBUILD: "Добавить и переоткрыть для новой сборки",
  INFORMATION_ONLY: "Информация",
};

function ScheduleImpactCard({
  item,
  action,
  deadline,
  timeZone,
  onAction,
  onDeadline,
}: {
  item: InvitationScheduleOpportunity;
  action?: InvitationIntentAction;
  deadline: string;
  timeZone: string;
  onAction: (action: InvitationIntentAction) => void;
  onDeadline: (value: string) => void;
}) {
  const informational = item.allowedActions.length === 1 && item.allowedActions[0] === "INFORMATION_ONLY";
  const asksDeadline =
    action === "ADD_TO_COLLECTION" || action === "ADD_AND_REOPEN_COLLECTION" || action === "ADD_AND_REOPEN_FOR_REBUILD";
  const minimum =
    item.scheduleStatus === "COLLECTING_PREFERENCES" && item.currentPreferenceDeadline
      ? instantToRestaurantLocalDateTime(item.currentPreferenceDeadline, timeZone)
      : instantToRestaurantLocalDateTime(new Date(Date.now() + 60_000), timeZone);
  const description =
    item.scheduleStatus === "COLLECTING_PREFERENCES"
      ? "Сейчас идёт сбор пожеланий. Если сотрудник примет приглашение, его можно добавить в этот сбор."
      : item.scheduleStatus === "PREFERENCES_CLOSED"
        ? "Сбор пожеланий закрыт. После принятия приглашения его можно открыть повторно; пожелания остальных сотрудников сохранятся."
        : item.scheduleStatus === "DRAFT_FROM_PREFERENCES"
          ? "График уже собран по пожеланиям. При добавлении сбор откроется повторно, а результат автосборки потребуется собрать заново. Пожелания остальных сотрудников сохранятся."
          : item.scheduleStatus === "PUBLISHED"
            ? "Сотрудник не будет автоматически добавлен в опубликованный график. После принятия его можно добавить вручную из графика."
            : "Сотрудник не будет автоматически добавлен в черновик. После принятия его можно добавить вручную.";

  return (
    <div className="border-subtle rounded-xl border bg-[var(--staffly-control)] p-4">
      <div className="text-strong font-medium">{item.scheduleTitle}</div>
      <div className="text-default mt-1 text-sm">{description}</div>
      {item.currentPreferenceDeadline && (
        <div className="text-muted mt-2 text-sm">
          Дедлайн: {formatInstantInTimeZone(item.currentPreferenceDeadline, timeZone)}
        </div>
      )}
      {item.lessThanSixHoursRemain && (
        <div className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          До окончания сбора осталось меньше 6 часов.
        </div>
      )}
      {item.preferenceMode && (
        <div className="text-muted mt-1 text-xs">
          Режим: {item.preferenceMode === "DAY_LEVEL" ? "по дням" : "варианты смен"}
        </div>
      )}
      {item.eligibilityProblems.length > 0 && (
        <ul className="mt-2 grid gap-1 text-sm text-red-600">
          {item.eligibilityProblems.map((problem, index) => (
            <li key={`${problem}-${index}`}>{eligibilityProblemMessage(problem)}</li>
          ))}
        </ul>
      )}
      {!informational && (
        <div className="mt-3 grid gap-2">
          {item.allowedActions.map((allowed) => {
            const disabled = allowed !== "DO_NOT_ADD" && item.eligibilityProblems.length > 0;
            return (
              <label key={allowed} className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : ""}`}>
                <input
                  type="radio"
                  name={`invitation-schedule-${item.scheduleId}`}
                  checked={action === allowed}
                  disabled={disabled}
                  onChange={() => onAction(allowed)}
                />
                {ACTION_LABEL[allowed]}
              </label>
            );
          })}
        </div>
      )}
      {asksDeadline && (
        <div className="mt-3">
          <label className="text-default text-sm">
            {item.newDeadlineRequired ? "Новый дедлайн" : "Продлить дедлайн (необязательно)"}
            <input
              className="border-subtle bg-app mt-1 block w-full rounded-lg border px-3 py-2"
              type="datetime-local"
              value={deadline}
              min={minimum ?? undefined}
              required={item.newDeadlineRequired}
              onChange={(event) => onDeadline(event.target.value)}
            />
          </label>
          <div className="text-muted mt-1 text-xs">Новый дедлайн будет применён только после принятия приглашения.</div>
        </div>
      )}
    </div>
  );
}

function eligibilityProblemMessage(problem: string): string {
  switch (problem) {
    case "MISSING_PREFERENCE_MODE":
      return "Добавление недоступно: для графика не настроен режим сбора пожеланий.";
    case "MISSING_FROZEN_SHIFT_OPTIONS_FOR_POSITION":
      return "Добавление недоступно: для этой должности нет замороженного набора вариантов смен.";
    default:
      return "Добавление в этот сбор сейчас недоступно.";
  }
}

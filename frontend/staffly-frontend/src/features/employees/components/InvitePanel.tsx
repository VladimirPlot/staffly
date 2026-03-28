import SelectField from "../../../shared/ui/SelectField";
import Button from "../../../shared/ui/Button";
import type { CountryCode } from "libphonenumber-js";
import type { PositionDto } from "../../dictionaries/api";
import { ROLE_LABEL } from "../utils/memberUtils";
import LazyPhoneInputField from "../../../shared/ui/LazyPhoneInputField";

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
  submitting: boolean;
  isSubmitDisabled: boolean;
  onChangePhone: (value: string | undefined) => void;
  onChangePhoneCountry: (
    country: CountryCode,
    meta?: { manual: boolean; locked: boolean },
  ) => void;
  onChangePositionId: (positionId: number | null) => void;
  onSubmit: () => void;
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
  submitting,
  isSubmitDisabled,
  onChangePhone,
  onChangePhoneCountry,
  onChangePositionId,
  onSubmit,
  onCancel,
  onResetDone,
}: InvitePanelProps) {
  if (!open) return null;

  return (
    <div className="mb-5 rounded-2xl border border-subtle bg-app p-4">
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
            onChange={(event) =>
              onChangePositionId(event.target.value ? Number(event.target.value) : null)
            }
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
              {submitting ? "Отправляем…" : "Отправить приглашение"}
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

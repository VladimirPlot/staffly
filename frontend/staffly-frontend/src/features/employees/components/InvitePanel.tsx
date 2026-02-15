import Input from "../../../shared/ui/Input";
import SelectField from "../../../shared/ui/SelectField";
import Button from "../../../shared/ui/Button";
import type { InviteRole } from "../../invitations/api";
import type { PositionDto, RestaurantRole } from "../../dictionaries/api";
import { ROLE_LABEL } from "../utils/memberUtils";

type InvitePanelProps = {
  open: boolean;
  inviteDone: boolean;
  phoneOrEmail: string;
  role: InviteRole;
  roleOptions: InviteRole[];
  positions: PositionDto[];
  loadingPositions: boolean;
  positionId: number | null;
  error: string | null;
  submitting: boolean;
  isSubmitDisabled: boolean;
  onChangePhoneOrEmail: (value: string) => void;
  onChangeRole: (role: InviteRole) => void;
  onChangePositionId: (positionId: number | null) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onResetDone: () => void;
};

export default function InvitePanel({
  open,
  inviteDone,
  phoneOrEmail,
  role,
  roleOptions,
  positions,
  loadingPositions,
  positionId,
  error,
  submitting,
  isSubmitDisabled,
  onChangePhoneOrEmail,
  onChangeRole,
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
          <Input
            label="Телефон или Email приглашённого"
            value={phoneOrEmail}
            onChange={(event) => onChangePhoneOrEmail(event.target.value)}
            placeholder="+79990000000 или name@example.com"
          />

          <SelectField
            label="Роль доступа"
            value={role}
            onChange={(event) => onChangeRole(event.target.value as InviteRole)}
          >
            {roleOptions.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABEL[value as RestaurantRole] || value}
              </option>
            ))}
          </SelectField>

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

          {error && <div className="text-sm text-red-600">{error}</div>}

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

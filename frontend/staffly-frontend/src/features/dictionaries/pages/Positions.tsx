import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import SelectField from "../../../shared/ui/SelectField";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { listMembers, type MemberDto } from "../../employees/api";
import {
  createPosition,
  deletePosition,
  listPositions,
  updatePosition,
  type PayType,
  type PositionDto,
  type RestaurantRole,
} from "../api";

const ROLE_LABEL: Record<RestaurantRole, string> = {
  ADMIN: "Админ",
  MANAGER: "Менеджер",
  STAFF: "Сотрудник",
};

type PositionCompensationForm = {
  payType: PayType | "";
  payRate: string;
  normHours: string;
};

function PositionCompensationFields({
  value,
  onChange,
  optional,
}: {
  value: PositionCompensationForm;
  onChange: (next: PositionCompensationForm) => void;
  optional?: boolean;
}) {
  return (
    <>
      <SelectField
        label={optional ? "Тип оплаты (опционально)" : "Тип оплаты"}
        value={value.payType}
        onChange={(event) =>
          onChange({
            ...value,
            payType: event.target.value as PayType | "",
          })
        }
      >
        {optional && <option value="">Не указан</option>}
        <option value="HOURLY">Почасовая</option>
        <option value="SHIFT">Сменная</option>
        <option value="SALARY">Оклад</option>
      </SelectField>
      <Input
        label={optional ? "Ставка (опционально)" : "Ставка"}
        type="number"
        inputMode="decimal"
        min="0"
        value={value.payRate}
        onChange={(event) => onChange({ ...value, payRate: event.target.value })}
      />
      {(value.payType === "SALARY" || (optional && value.normHours !== "")) && (
        <Input
          label={optional ? "Норматив часов (опционально)" : "Норматив часов"}
          type="number"
          inputMode="numeric"
          value={value.normHours}
          onChange={(event) => onChange({ ...value, normHours: event.target.value })}
        />
      )}
    </>
  );
}

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCompensation(form: PositionCompensationForm): {
  payType: PayType | null;
  payRate: number | null;
  normHours: number | null;
  error: string | null;
} {
  const payRate = toNullableNumber(form.payRate);
  if (payRate != null && payRate < 0) {
    return { payType: null, payRate: null, normHours: null, error: "Ставка не может быть меньше 0" };
  }

  if (payRate != null && !form.payType) {
    return {
      payType: null,
      payRate: null,
      normHours: null,
      error: "Выберите тип оплаты, если указана ставка",
    };
  }

  const normHours = form.payType === "SALARY" ? toNullableNumber(form.normHours) : null;

  return {
    payType: form.payType || null,
    payRate,
    normHours,
    error: null,
  };
}

export default function PositionsPage() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  const [items, setItems] = React.useState<PositionDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [members, setMembers] = React.useState<MemberDto[]>([]);
  const [editing, setEditing] = React.useState<PositionDto | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editLevel, setEditLevel] = React.useState<RestaurantRole>("STAFF");
  const [editCompensation, setEditCompensation] = React.useState<PositionCompensationForm>({
    payType: "HOURLY",
    payRate: "",
    normHours: "",
  });
  const [formError, setFormError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [level, setLevel] = React.useState<RestaurantRole>("STAFF");
  const [createCompensation, setCreateCompensation] = React.useState<PositionCompensationForm>({
    payType: "",
    payRate: "",
    normHours: "",
  });
  const [creating, setCreating] = React.useState(false);

  const canManage = true;

  const load = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const [positions, restaurantMembers] = await Promise.all([
        listPositions(restaurantId),
        listMembers(restaurantId),
      ]);
      setItems(positions);
      setMembers(restaurantMembers);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  React.useEffect(() => {
    if (restaurantId) void load();
  }, [restaurantId, load]);

  React.useEffect(() => {
    if (!editing) return;
    setEditName(editing.name);
    setEditLevel(editing.level);
    setEditCompensation({
      payType: editing.payType ?? "HOURLY",
      payRate: editing.payRate?.toString() ?? "",
      normHours: editing.normHours?.toString() ?? "",
    });
    setFormError(null);
  }, [editing]);

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>Сначала выберите ресторан.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-default">
        <BackToHome className="text-sm" />
        <Link
          to="/employees/invite"
          title="Сотрудники"
          aria-label="Сотрудники"
          className={
            "inline-flex items-center gap-0 rounded-2xl border border-subtle " +
            "bg-surface px-2 py-1 text-sm font-medium text-default shadow-[var(--staffly-shadow)] " +
            "transition hover:bg-app focus:outline-none focus:ring-2 ring-default"
          }
        >
          <Icon icon={ArrowLeft} size="xs" decorative />
          <span>Сотрудники</span>
        </Link>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Должности</h2>
      </div>

      <Card className="mb-4">
        <div className="mb-3 text-sm font-medium">Добавить должность</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Название"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Официант"
          />
          <SelectField
            label="Уровень"
            value={level}
            onChange={(event) => setLevel(event.target.value as RestaurantRole)}
          >
            <option value="STAFF">Сотрудник</option>
            <option value="MANAGER">Менеджер</option>
            <option value="ADMIN">Админ</option>
          </SelectField>
          <PositionCompensationFields
            value={createCompensation}
            onChange={setCreateCompensation}
            optional
          />
          <div className="flex items-end">
            <Button
              disabled={!name.trim() || creating || !canManage}
              onClick={async () => {
                if (!name.trim()) return;
                const compensation = parseCompensation(createCompensation);
                if (compensation.error) {
                  setFormError(compensation.error);
                  return;
                }

                try {
                  setCreating(true);
                  setFormError(null);
                  await createPosition(restaurantId, {
                    name,
                    level,
                    payType: compensation.payType,
                    payRate: compensation.payRate,
                    normHours: compensation.normHours,
                  });
                  setName("");
                  setLevel("STAFF");
                  setCreateCompensation({ payType: "", payRate: "", normHours: "" });
                  await load();
                } catch (e: any) {
                  setFormError(e?.friendlyMessage || "Ошибка создания");
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Создаём…" : "Создать"}
            </Button>
          </div>
        </div>
        {formError && <div className="mt-2 text-xs text-red-600">{formError}</div>}
      </Card>

      <Card>
        {loading ? (
          <div>Загрузка…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-muted">Пока нет должностей.</div>
        ) : (
          <div className="divide-y">
            {items.map((position) => (
              <div
                key={position.id}
                className="flex flex-col gap-2 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-medium">{position.name}</div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!canManage}
                      onClick={() => setEditing(position)}
                      aria-label="Редактировать должность"
                    >
                      <Icon icon={Pencil} size="xs" />
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!canManage}
                      onClick={async () => {
                        const hasEmployees = members.some((member) => member.positionId === position.id);
                        if (hasEmployees) {
                          alert("В ресторане есть сотрудники с этой должностью");
                          return;
                        }
                        if (!confirm(`Удалить должность «${position.name}»?`)) return;
                        try {
                          await deletePosition(restaurantId, position.id);
                          await load();
                        } catch (e: any) {
                          alert(e?.friendlyMessage || "Ошибка удаления");
                        }
                      }}
                      aria-label="Удалить должность"
                    >
                      <Icon icon={Trash2} size="xs" />
                    </Button>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <span className="rounded-full border border-subtle px-2 py-0.5 text-muted">
                      {ROLE_LABEL[position.level]}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Редактировать должность"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button
              onClick={async () => {
                if (!editing || !restaurantId) return;
                const compensation = parseCompensation(editCompensation);
                if (compensation.error) {
                  setFormError(compensation.error);
                  return;
                }
                try {
                  setFormError(null);
                  await updatePosition(restaurantId, editing.id, {
                    name: editName.trim(),
                    level: editLevel,
                    active: editing.active,
                    payType: compensation.payType ?? undefined,
                    payRate: compensation.payRate,
                    normHours: compensation.normHours,
                  });
                  setEditing(null);
                  await load();
                } catch (e: any) {
                  setFormError(e?.friendlyMessage || "Ошибка обновления");
                }
              }}
              disabled={!editName.trim()}
            >
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Название" value={editName} onChange={(event) => setEditName(event.target.value)} />
          <SelectField
            label="Уровень"
            value={editLevel}
            onChange={(event) => setEditLevel(event.target.value as RestaurantRole)}
          >
            <option value="STAFF">Сотрудник</option>
            <option value="MANAGER">Менеджер</option>
            <option value="ADMIN">Админ</option>
          </SelectField>
          <PositionCompensationFields value={editCompensation} onChange={setEditCompensation} />
        </div>
        {formError && <div className="mt-2 text-xs text-red-600">{formError}</div>}
      </Modal>
    </div>
  );
}

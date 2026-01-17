import React from "react";
import { Link } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import SelectField from "../../../shared/ui/SelectField";
import BackToHome from "../../../shared/ui/BackToHome";
import Modal from "../../../shared/ui/Modal";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Icon from "../../../shared/ui/Icon";
import { listMembers, type MemberDto } from "../../employees/api";

import {
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
  type PositionDto,
  type PayType,
  type RestaurantRole,
} from "../api";

const ROLE_LABEL: Record<RestaurantRole, string> = {
  ADMIN: "Админ",
  MANAGER: "Менеджер",
  STAFF: "Сотрудник",
};

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
  const [editPayType, setEditPayType] = React.useState<PayType>("HOURLY");
  const [editPayRate, setEditPayRate] = React.useState("");
  const [editNormHours, setEditNormHours] = React.useState("");

  // форма создания
  const [name, setName] = React.useState("");
  const [level, setLevel] = React.useState<RestaurantRole>("STAFF");
  const [creating, setCreating] = React.useState(false);

  // Показываем UI всем, а права проверит бэкенд (403 при отсутствии прав).
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
    setEditPayType(editing.payType);
    setEditPayRate(editing.payRate?.toString() ?? "");
    setEditNormHours(editing.normHours?.toString() ?? "");
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
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-zinc-700">
        <BackToHome className="text-sm" />
        <Link
          to="/employees/invite"
          title="Сотрудники"
          aria-label="Сотрудники"
          className={
            "inline-flex items-center gap-0 rounded-2xl border border-zinc-200 " +
            "bg-white px-2 py-1 text-sm font-medium text-zinc-700 shadow-sm " +
            "transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          }
        >
          <Icon icon={ArrowLeft} size="xs" decorative />
          <span>Сотрудники</span>
        </Link>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Должности</h2>
      </div>

      {/* Создание */}
      <Card className="mb-4">
        <div className="mb-3 text-sm font-medium">Добавить должность</div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Официант"
          />
          <div className="sm:w-56">
            <SelectField
              label="Уровень"
              value={level}
              onChange={(e) => setLevel(e.target.value as RestaurantRole)}
            >
              <option value="STAFF">Сотрудник</option>
              <option value="MANAGER">Менеджер</option>
              <option value="ADMIN">Админ</option>
            </SelectField>
          </div>
          <div className="flex items-end">
            <Button
              disabled={!name.trim() || creating || !canManage}
              onClick={async () => {
                if (!name.trim()) return;
                try {
                  setCreating(true);
                  await createPosition(restaurantId, { name, level });
                  setName("");
                  setLevel("STAFF");
                  await load();
                } catch (e: any) {
                  alert(e?.friendlyMessage || "Ошибка создания");
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Создаём…" : "Создать"}
            </Button>
          </div>
        </div>
        {!canManage && (
          <div className="mt-2 text-xs text-zinc-500">
            У вас нет прав на создание должностей (нужен MANAGER или ADMIN).
          </div>
        )}
      </Card>

      {/* Список */}
      <Card>
        {loading ? (
          <div>Загрузка…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-zinc-600">Пока нет должностей.</div>
        ) : (
          <div className="divide-y">
            {items.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-medium">{p.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
                    <span className="rounded-full border px-2 py-0.5">
                      {ROLE_LABEL[p.level]}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    disabled={!canManage}
                    onClick={() => setEditing(p)}
                    aria-label="Редактировать должность"
                  >
                    <Icon icon={Pencil} size="xs" />
                  </button>

                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    disabled={!canManage}
                    onClick={async () => {
                      const hasEmployees = members.some(
                        (member) => member.positionId === p.id,
                      );
                      if (hasEmployees) {
                        alert("В ресторане есть сотрудники с этой должностью");
                        return;
                      }
                      if (!confirm(`Удалить должность «${p.name}»?`)) return;
                      try {
                        await deletePosition(restaurantId, p.id);
                        await load();
                      } catch (e: any) {
                        alert(e?.friendlyMessage || "Ошибка удаления");
                      }
                    }}
                    aria-label="Удалить должность"
                  >
                    <Icon icon={Trash2} size="xs" />
                  </button>
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
                try {
                  await updatePosition(restaurantId, editing.id, {
                    name: editName.trim(),
                    level: editLevel,
                    active: editing.active,
                    payType: editPayType,
                    payRate: editPayRate ? Number(editPayRate) : null,
                    normHours:
                      editPayType === "SALARY" && editNormHours
                        ? Number(editNormHours)
                        : null,
                  });
                  setEditing(null);
                  await load();
                } catch (e: any) {
                  alert(e?.friendlyMessage || "Ошибка обновления");
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
          <Input
            label="Название"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <SelectField
            label="Уровень"
            value={editLevel}
            onChange={(e) => setEditLevel(e.target.value as RestaurantRole)}
          >
            <option value="STAFF">Сотрудник</option>
            <option value="MANAGER">Менеджер</option>
            <option value="ADMIN">Админ</option>
          </SelectField>
          <SelectField
            label="Тип оплаты"
            value={editPayType}
            onChange={(e) => setEditPayType(e.target.value as PayType)}
          >
            <option value="HOURLY">Почасовая</option>
            <option value="SHIFT">Сменная</option>
            <option value="SALARY">Оклад</option>
          </SelectField>
          <Input
            label="Ставка"
            type="number"
            inputMode="decimal"
            value={editPayRate}
            onChange={(e) => setEditPayRate(e.target.value)}
          />
          {editPayType === "SALARY" && (
            <Input
              label="Норматив часов"
              type="number"
              inputMode="numeric"
              value={editNormHours}
              onChange={(e) => setEditNormHours(e.target.value)}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

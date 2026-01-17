import React from "react";
import { Link } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import SelectField from "../../../shared/ui/SelectField";
import Modal from "../../../shared/ui/Modal";
import BackToHome from "../../../shared/ui/BackToHome";
import Icon from "../../../shared/ui/Icon";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../../../shared/providers/AuthProvider";
import {
  createMasterSchedule,
  deleteMasterSchedule,
  listMasterSchedules,
} from "../api";
import type { MasterScheduleMode, MasterScheduleSummaryDto } from "../types";
import { clampPeriodDays } from "../utils/date";

const MAX_PERIOD_DAYS = 93;

export default function MasterSchedulesPage() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [items, setItems] = React.useState<MasterScheduleSummaryDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const [name, setName] = React.useState("");
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [mode, setMode] = React.useState<MasterScheduleMode>("DETAILED");
  const [plannedRevenue, setPlannedRevenue] = React.useState("");

  const load = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listMasterSchedules(restaurantId);
      setItems(data);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  React.useEffect(() => {
    if (restaurantId) void load();
  }, [restaurantId, load]);

  const periodDays =
    periodStart && periodEnd ? clampPeriodDays(periodStart, periodEnd) : null;
  const periodError =
    periodDays && (periodDays <= 0 || periodDays > MAX_PERIOD_DAYS)
      ? `Период должен быть от 1 до ${MAX_PERIOD_DAYS} дней`
      : null;

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>Сначала выберите ресторан.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-4">
      <div className="flex items-center justify-between">
        <BackToHome />
        <Button onClick={() => setCreateOpen(true)}>Создать график</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold">Мастер-графики</h2>
        </div>
        {loading ? (
          <div className="p-6">Загрузка…</div>
        ) : error ? (
          <div className="p-6 text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-zinc-600">Пока нет мастер-графиков.</div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-medium text-zinc-900 break-words">
                    {item.name}
                  </div>
                  <div className="text-sm text-zinc-600">
                    {item.periodStart} — {item.periodEnd}
                  </div>
                  {item.plannedRevenue != null && (
                    <div className="text-xs text-zinc-500">
                      Плановая выручка: {item.plannedRevenue}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/master-schedules/${item.id}`}
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    <Icon icon={Pencil} size="xs" />
                    Редактировать
                  </Link>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    onClick={async () => {
                      if (!restaurantId) return;
                      if (!window.confirm("Удалить мастер-график?")) return;
                      await deleteMasterSchedule(restaurantId, item.id);
                      await load();
                    }}
                  >
                    <Icon icon={Trash2} size="xs" />
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый мастер-график"
        description="Заполните параметры периода и режима."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={async () => {
                if (!restaurantId) return;
                if (!name.trim()) return;
                if (!periodStart || !periodEnd || periodError) return;
                const payload = {
                  name: name.trim(),
                  periodStart,
                  periodEnd,
                  mode,
                  plannedRevenue: plannedRevenue ? Number(plannedRevenue) : null,
                };
                await createMasterSchedule(restaurantId, payload);
                setCreateOpen(false);
                setName("");
                setPeriodStart("");
                setPeriodEnd("");
                setMode("DETAILED");
                setPlannedRevenue("");
                await load();
              }}
              disabled={!name.trim() || !periodStart || !periodEnd || Boolean(periodError)}
            >
              Создать
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Мастер-график май"
          />
          <SelectField label="Режим" value={mode} onChange={(e) => setMode(e.target.value as MasterScheduleMode)}>
            <option value="DETAILED">DETAILED</option>
            <option value="COMPACT">COMPACT</option>
          </SelectField>
          <Input
            label="Начало периода"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            error={periodError ?? undefined}
          />
          <Input
            label="Конец периода"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            error={periodError ?? undefined}
          />
          <Input
            label="Плановая выручка"
            type="number"
            inputMode="decimal"
            value={plannedRevenue}
            onChange={(e) => setPlannedRevenue(e.target.value)}
            placeholder="Необязательно"
          />
        </div>
      </Modal>
    </div>
  );
}

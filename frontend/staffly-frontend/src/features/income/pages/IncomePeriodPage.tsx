import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import PersonalNav from "../components/PersonalNav";
import {
  IncomePeriodDetail,
  IncomeShift,
  SaveIncomeShiftPayload,
  createIncomeShift,
  deleteIncomeShift,
  getIncomePeriod,
} from "../api";

const today = () => new Date().toISOString().slice(0, 10);

export default function IncomePeriodPage() {
  const { periodId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = React.useState<IncomePeriodDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [type, setType] = React.useState<"SHIFT" | "HOURLY">("SHIFT");
  const [form, setForm] = React.useState<SaveIncomeShiftPayload>({
    date: today(),
    type: "SHIFT",
    fixedAmount: 0,
  });

  React.useEffect(() => {
    (async () => {
      if (!periodId) return;
      try {
        const detail = await getIncomePeriod(Number(periodId));
        setData(detail);
      } catch (e) {
        navigate("/me/income");
      } finally {
        setLoading(false);
      }
    })();
  }, [periodId, navigate]);

  const onChange = (patch: Partial<SaveIncomeShiftPayload>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const onCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodId) return;
    setSaving(true);
    try {
      const created = await createIncomeShift(Number(periodId), { ...form, type });
      setData((prev) => (prev ? { ...prev, shifts: [created, ...prev.shifts] } : prev));
      setForm({ date: today(), type, fixedAmount: 0 });
    } finally {
      setSaving(false);
    }
  };

  const onDeleteShift = async (shift: IncomeShift) => {
    if (!window.confirm("Удалить смену?")) return;
    await deleteIncomeShift(shift.id);
    setData((prev) =>
      prev ? { ...prev, shifts: prev.shifts.filter((s) => s.id !== shift.id) } : prev
    );
  };

  const hours = type === "HOURLY" && form.startTime && form.endTime ? calcHours(form.startTime, form.endTime) : 0;

  if (loading) return <div className="text-sm text-zinc-600">Загружаем период...</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PersonalNav>
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Link to="/me/income" className="text-zinc-500 hover:underline">
            Мои доходы
          </Link>
          <span>/</span>
          <span>{data.period.name}</span>
        </div>
      </PersonalNav>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="text-lg font-semibold">Итоги периода</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm text-zinc-700">
          <Stat label="Смен" value={data.period.shiftCount} />
          <Stat label="Часы" value={data.period.totalHours} />
          <Stat label="Доход" value={`${data.period.totalIncome} ₽`} />
          <Stat label="Чаевые" value={`${data.period.totalTips} ₽`} />
          <Stat label="Личная выручка" value={`${data.period.totalPersonalRevenue} ₽`} />
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-2 text-base font-semibold">Добавить смену</div>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreateShift}>
          <Input
            label="Дата"
            type="date"
            value={form.date}
            onChange={(e) => onChange({ date: e.target.value })}
            required
          />
          <div className="flex flex-col gap-2 text-sm text-zinc-700">
            <span className="text-zinc-600">Тип оплаты</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="SHIFT"
                  checked={type === "SHIFT"}
                  onChange={() => {
                    setType("SHIFT");
                    onChange({ type: "SHIFT" });
                  }}
                />
                По смене
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="HOURLY"
                  checked={type === "HOURLY"}
                  onChange={() => {
                    setType("HOURLY");
                    onChange({ type: "HOURLY" });
                  }}
                />
                Почасовая
              </label>
            </div>
          </div>

          {type === "SHIFT" ? (
            <Input
              label="Оплата за смену"
              type="number"
              min={0}
              step={0.01}
              value={form.fixedAmount ?? 0}
              onChange={(e) => onChange({ fixedAmount: Number(e.target.value) })}
              required
              className="md:col-span-2"
            />
          ) : (
            <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
              <Input
                label="Начало смены"
                type="time"
                step={900}
                value={form.startTime ?? ""}
                onChange={(e) => onChange({ startTime: e.target.value })}
                required
              />
              <Input
                label="Окончание смены"
                type="time"
                step={900}
                value={form.endTime ?? ""}
                onChange={(e) => onChange({ endTime: e.target.value })}
                required
              />
              <Input
                label="Ставка в час"
                type="number"
                min={0}
                step={0.01}
                value={form.hourlyRate ?? ""}
                onChange={(e) => onChange({ hourlyRate: Number(e.target.value) })}
                required
              />
              <div className="rounded-xl border border-dashed border-zinc-200 p-3 text-sm text-zinc-600">
                Итого часов: {hours.toFixed(2)}
              </div>
            </div>
          )}

          <details className="md:col-span-2 rounded-xl border border-zinc-200 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Дополнительно</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Input
                label="Чаевые"
                type="number"
                min={0}
                step={0.01}
                value={form.tipsAmount ?? ""}
                onChange={(e) => onChange({ tipsAmount: Number(e.target.value) })}
              />
              <Input
                label="Личная выручка"
                type="number"
                min={0}
                step={0.01}
                value={form.personalRevenue ?? ""}
                onChange={(e) => onChange({ personalRevenue: Number(e.target.value) })}
              />
              <Input
                label="Комментарий"
                placeholder='Например: "Банкет"'
                value={form.comment ?? ""}
                onChange={(e) => onChange({ comment: e.target.value })}
              />
            </div>
          </details>

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Сохраняем..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-3 text-base font-semibold">Смены</div>
        {data.shifts.length === 0 ? (
          <div className="text-sm text-zinc-600">Пока нет смен в этом периоде.</div>
        ) : (
          <div className="space-y-3">
            {data.shifts.map((shift) => (
              <div key={shift.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{shift.date}</div>
                    <div className="text-zinc-600">
                      {shift.type === "SHIFT"
                        ? `По смене: ${shift.fixedAmount} ₽`
                        : `Почасовая: ${shift.startTime} - ${shift.endTime}, ставка ${shift.hourlyRate} ₽`}
                    </div>
                    <div className="text-zinc-600">
                      Доход: {shift.totalIncome} ₽
                      {Number(shift.tipsAmount ?? 0) > 0 && ` • Чаевые: ${shift.tipsAmount} ₽`}
                      {Number(shift.personalRevenue ?? 0) > 0 && ` • Личная выручка: ${shift.personalRevenue} ₽`}
                    </div>
                    {shift.comment && <div className="text-zinc-500">{shift.comment}</div>}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => onDeleteShift(shift)}
                  >
                    удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function calcHours(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) return 0;
  return (endMinutes - startMinutes) / 60;
}

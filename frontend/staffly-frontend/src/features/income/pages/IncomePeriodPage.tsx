import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import ContentText from "../../../shared/ui/ContentText";
import Icon from "../../../shared/ui/Icon";
import PersonalNav from "../components/PersonalNav";
import type { IncomePeriodDetail, IncomeShift, SaveIncomeShiftPayload } from "../api";
import { createIncomeShift, deleteIncomeShift, getIncomePeriod } from "../api";

const today = () => new Date().toISOString().slice(0, 10);

export default function IncomePeriodPage() {
  const { periodId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = React.useState<IncomePeriodDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [type, setType] = React.useState<"SHIFT" | "HOURLY">("SHIFT");
  const [showAddShift, setShowAddShift] = React.useState(false);
  const [form, setForm] = React.useState<SaveIncomeShiftPayload>({
    date: today(),
    type: "SHIFT",
  });

  const loadPeriod = React.useCallback(async () => {
    if (!periodId) return;
    const detail = await getIncomePeriod(Number(periodId));
    setData(detail);
  }, [periodId]);

  React.useEffect(() => {
    (async () => {
      if (!periodId) return;
      try {
        await loadPeriod();
      } catch {
        navigate("/me/income");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPeriod, periodId, navigate]);

  const onChange = (patch: Partial<SaveIncomeShiftPayload>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const onCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodId) return;
    setSaving(true);
    const payload: SaveIncomeShiftPayload =
      type === "SHIFT"
        ? {
            date: form.date,
            type: "SHIFT",
            fixedAmount: form.fixedAmount,
            tipsAmount: form.tipsAmount,
            personalRevenue: form.personalRevenue,
            comment: form.comment,
          }
        : {
            date: form.date,
            type: "HOURLY",
            startTime: form.startTime,
            endTime: form.endTime,
            hourlyRate: form.hourlyRate,
            tipsAmount: form.tipsAmount,
            personalRevenue: form.personalRevenue,
            comment: form.comment,
          };
    try {
      await createIncomeShift(Number(periodId), payload);
      try {
        await loadPeriod();
      } catch {
        window.alert("Смена сохранена, но не удалось обновить период. Обновите страницу.");
      }
      setForm({ date: today(), type });
    } finally {
      setSaving(false);
    }
  };

  const onDeleteShift = async (shift: IncomeShift) => {
    if (!window.confirm("Удалить смену?")) return;
    await deleteIncomeShift(shift.id);
    try {
      await loadPeriod();
    } catch {
      window.alert("Смена удалена, но не удалось обновить период. Обновите страницу.");
    }
  };

  const hours = type === "HOURLY" && form.startTime && form.endTime ? calcHours(form.startTime, form.endTime) : 0;

  if (loading) return <div className="text-muted text-sm">Загружаем период...</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <PersonalNav>
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Link to="/me/income" className="text-muted hover:underline">
            Мои доходы
          </Link>
          <span>/</span>
          <span>{data.period.name}</span>
        </div>
      </PersonalNav>

      <div className="bg-surface rounded-2xl p-4 shadow-[var(--staffly-shadow)]">
        <div className="text-lg font-semibold">Итоги периода</div>
        <div className="text-default mt-2 grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-3">
          <Stat label="Смен" value={data.period.shiftCount} />
          <Stat label="Часы" value={data.period.totalHours} />
          <Stat label="Доход" value={`${data.period.totalIncome} ₽`} />
          <Stat label="Чаевые" value={`${data.period.totalTips} ₽`} />
          <Stat label="Личная выручка" value={`${data.period.totalPersonalRevenue} ₽`} />
        </div>
      </div>

      <div className="bg-surface rounded-2xl p-4 shadow-[var(--staffly-shadow)]">
        <div className="mb-2 flex items-center justify-between gap-2 text-base font-semibold">
          <span>Добавить смену</span>
          <Button variant="outline" onClick={() => setShowAddShift((prev) => !prev)}>
            {showAddShift ? "Скрыть" : "Добавить смену"}
          </Button>
        </div>
        {showAddShift && (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreateShift}>
            <Input
              label="Дата"
              type="date"
              value={form.date}
              onChange={(e) => onChange({ date: e.target.value })}
              required
            />
            <div className="text-default flex flex-col gap-2 text-sm">
              <span className="text-muted">Тип оплаты</span>
              <div className="flex gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value="SHIFT"
                    checked={type === "SHIFT"}
                    onChange={() => {
                      setType("SHIFT");
                      onChange({ type: "SHIFT", startTime: undefined, endTime: undefined, hourlyRate: undefined });
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
                      onChange({ type: "HOURLY", fixedAmount: undefined });
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
                min={0.01}
                step={0.01}
                value={form.fixedAmount ?? ""}
                onChange={(e) => onChange({ fixedAmount: e.target.value === "" ? undefined : Number(e.target.value) })}
                required
                className="md:col-span-2"
              />
            ) : (
              <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
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
                  onChange={(e) => onChange({ hourlyRate: e.target.value === "" ? undefined : Number(e.target.value) })}
                  required
                />
                <div className="border-subtle text-muted rounded-2xl border border-dashed p-3 text-sm">
                  Итого часов: {hours.toFixed(2)}
                </div>
              </div>
            )}

            <details className="border-subtle rounded-2xl border p-3 text-sm md:col-span-2">
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

            <div className="flex justify-end md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Сохраняем..." : "Сохранить"}
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-surface rounded-2xl p-4 shadow-[var(--staffly-shadow)]">
        <div className="mb-3 text-base font-semibold">Смены</div>
        {data.shifts.length === 0 ? (
          <div className="text-muted text-sm">Пока нет смен в этом периоде.</div>
        ) : (
          <div className="space-y-3">
            {data.shifts.map((shift) => (
              <div key={shift.id} className="border-subtle rounded-2xl border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{shift.date}</div>
                    <div className="text-muted">
                      {shift.type === "SHIFT"
                        ? `По смене: ${shift.fixedAmount} ₽`
                        : `Почасовая: ${shift.startTime} - ${shift.endTime}, ставка ${shift.hourlyRate} ₽`}
                    </div>
                    <div className="text-muted">
                      Доход: {shift.totalIncome} ₽
                      {Number(shift.tipsAmount ?? 0) > 0 && ` • Чаевые: ${shift.tipsAmount} ₽`}
                      {Number(shift.personalRevenue ?? 0) > 0 && ` • Личная выручка: ${shift.personalRevenue} ₽`}
                    </div>
                    {shift.comment && <ContentText className="text-muted">{shift.comment}</ContentText>}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 text-xs"
                    onClick={() => onDeleteShift(shift)}
                    aria-label="Удалить смену"
                    leftIcon={<Icon icon={Trash2} size="xs" decorative />}
                  >
                    Удалить
                  </Button>
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
    <div className="border-subtle rounded-2xl border p-3">
      <div className="text-muted text-xs uppercase">{label}</div>
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

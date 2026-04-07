import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import ContentText from "../../../shared/ui/ContentText";
import Icon from "../../../shared/ui/Icon";
import { cn } from "../../../shared/lib/cn";
import useValidatedTextField from "../../../shared/hooks/useValidatedTextField";
import PersonalNav from "../components/PersonalNav";
import type { IncomePeriodDetail, IncomeShift, SaveIncomeShiftPayload } from "../api";
import { createIncomeShift, deleteIncomeShift, getIncomePeriod } from "../api";
import ShiftDateInput from "../components/ShiftDateInput";
import {
  formatShiftDateFromIso,
  getShiftDateDraftError,
  getShiftDateError,
  normalizeShiftDateForSubmit,
} from "../utils/shiftDate";

const today = () => formatShiftDateFromIso(new Date().toISOString().slice(0, 10));
type IncomeShiftForm = Partial<SaveIncomeShiftPayload>;

export default function IncomePeriodPage() {
  const { periodId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = React.useState<IncomePeriodDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [type, setType] = React.useState<"SHIFT" | "HOURLY">("SHIFT");
  const [showAddShift, setShowAddShift] = React.useState(false);
  const dateField = useValidatedTextField({
    initialValue: today(),
    getError: getShiftDateError,
    getDraftError: getShiftDateDraftError,
    normalizeForSubmit: normalizeShiftDateForSubmit,
  });
  const [form, setForm] = React.useState<IncomeShiftForm>({
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
    dateField.setSubmitAttempted(true);
    if (!dateField.isValid) {
      return;
    }

    setSaving(true);
    const date = dateField.getSubmitValue();
    if (!date) {
      setSaving(false);
      return;
    }
    const payload: SaveIncomeShiftPayload =
      type === "SHIFT"
        ? {
            date,
            type: "SHIFT",
            fixedAmount: form.fixedAmount,
            tipsAmount: form.tipsAmount,
            personalRevenue: form.personalRevenue,
            comment: form.comment,
          }
        : {
            date,
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
      dateField.setValue(today());
      dateField.resetValidation();
      setForm({ type });
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

      <section className="bg-surface rounded-2xl p-4 shadow-[var(--staffly-shadow)] sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <Link to="/me/income" className="text-muted text-sm hover:underline">
                Мои доходы
              </Link>
              <div className="text-2xl font-semibold text-balance text-[var(--staffly-text-strong)]">
                {data.period.name}
              </div>
              <p className="text-muted text-sm text-pretty">
                {data.period.description?.trim() || "Добавляйте смены и держите доход по этому периоду в одном месте."}
              </p>
            </div>
            <div className="border-subtle text-default w-fit rounded-full border bg-[color:var(--staffly-control)] px-3 py-1.5 text-sm">
              {data.period.shiftCount} {pluralizeShift(data.period.shiftCount)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            <Stat label="Смен" value={data.period.shiftCount} />
            <Stat label="Часы" value={data.period.totalHours} />
            <Stat label="Доход" value={`${data.period.totalIncome} ₽`} accent />
            <Stat label="Чаевые" value={`${data.period.totalTips} ₽`} />
            <Stat label="Личная выручка" value={`${data.period.totalPersonalRevenue} ₽`} />
          </div>
        </div>
      </section>

      <section className="bg-surface rounded-2xl p-4 shadow-[var(--staffly-shadow)] sm:p-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="text-base font-semibold text-[var(--staffly-text-strong)]">Добавить смену</div>
            <p className="text-muted text-sm text-pretty">
              Сначала выберите дату и тип оплаты, затем заполните только нужные поля.
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowAddShift((prev) => !prev)} className="w-full sm:w-auto">
            {showAddShift ? "Скрыть" : "Добавить смену"}
          </Button>
        </div>
        {showAddShift && (
          <form className="grid gap-4" onSubmit={onCreateShift}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="border-subtle rounded-[1.5rem] border bg-[color:var(--staffly-control)]/45 p-3 sm:p-4">
                <ShiftDateInput
                  label="Дата"
                  value={dateField.value}
                  onChange={dateField.setValue}
                  onBlur={() => dateField.setTouched(true)}
                  error={dateField.error}
                />
              </div>
              <div className="border-subtle rounded-[1.5rem] border bg-[color:var(--staffly-control)]/45 p-3 sm:p-4">
                <div className="text-muted mb-2 text-sm">Тип оплаты</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={type === "SHIFT"}
                    onClick={() => {
                      setType("SHIFT");
                      onChange({ type: "SHIFT", startTime: undefined, endTime: undefined, hourlyRate: undefined });
                    }}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm font-medium transition focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none",
                      type === "SHIFT"
                        ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                        : "border-subtle bg-surface text-default border",
                    )}
                  >
                    По смене
                  </button>
                  <button
                    type="button"
                    aria-pressed={type === "HOURLY"}
                    onClick={() => {
                      setType("HOURLY");
                      onChange({ type: "HOURLY", fixedAmount: undefined });
                    }}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm font-medium transition focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none",
                      type === "HOURLY"
                        ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                        : "border-subtle bg-surface text-default border",
                    )}
                  >
                    Почасовая
                  </button>
                </div>
              </div>
            </div>

            {type === "SHIFT" ? (
              <div className="border-subtle rounded-[1.5rem] border bg-[color:var(--staffly-control)]/45 p-3 sm:p-4">
                <Input
                  label="Оплата за смену"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.fixedAmount ?? ""}
                  onChange={(e) =>
                    onChange({ fixedAmount: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                  required
                />
              </div>
            ) : (
              <div className="border-subtle rounded-[1.5rem] border bg-[color:var(--staffly-control)]/45 p-3 sm:p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                    onChange={(e) =>
                      onChange({ hourlyRate: e.target.value === "" ? undefined : Number(e.target.value) })
                    }
                    required
                  />
                  <div className="border-subtle min-w-0 border-t pt-3 md:pt-4 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-4">
                    <div className="text-muted mb-1 block min-w-0 text-sm [overflow-wrap:anywhere]">Итого часов</div>
                    <div className="text-default text-2xl font-semibold tabular-nums">{hours.toFixed(2)}</div>
                    <div className="text-muted mt-1 text-xs text-pretty">
                      Рассчитывается по времени начала и окончания смены.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <details className="border-subtle rounded-[1.5rem] border bg-[color:var(--staffly-control)]/35 p-3 text-sm sm:p-4">
              <summary className="cursor-pointer list-none font-medium text-[var(--staffly-text-strong)]">
                <span className="flex items-center justify-between gap-3">
                  <span>Дополнительно</span>
                  <span className="text-muted text-xs">Чаевые, выручка и комментарий</span>
                </span>
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Input
                  label="Чаевые"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.tipsAmount ?? ""}
                  onChange={(e) => onChange({ tipsAmount: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
                <Input
                  label="Личная выручка"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.personalRevenue ?? ""}
                  onChange={(e) =>
                    onChange({ personalRevenue: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                />
                <Input
                  label="Комментарий"
                  placeholder='Например: "Банкет"'
                  value={form.comment ?? ""}
                  onChange={(e) => onChange({ comment: e.target.value })}
                />
              </div>
            </details>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted text-sm">
                {type === "SHIFT"
                  ? "Подходит для фиксированной оплаты за день."
                  : "Используйте почасовую ставку, если доход зависит от часов."}
              </div>
              <Button type="submit" disabled={saving} className="min-h-11 w-full px-5 sm:w-auto">
                {saving ? "Сохраняем..." : "Сохранить"}
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="bg-surface rounded-2xl p-4 shadow-[var(--staffly-shadow)] sm:p-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-[var(--staffly-text-strong)]">Смены</div>
            <div className="text-muted text-sm">Все сохранённые записи по этому периоду.</div>
          </div>
          <div className="border-subtle text-default rounded-full border bg-[color:var(--staffly-control)] px-3 py-1 text-xs">
            {data.shifts.length}
          </div>
        </div>
        {data.shifts.length === 0 ? (
          <div className="border-subtle text-muted rounded-[1.5rem] border border-dashed p-4 text-sm">
            Пока нет смен в этом периоде. Добавьте первую запись выше.
          </div>
        ) : (
          <div className="space-y-3">
            {data.shifts.map((shift) => {
              const shiftDate = formatShiftDate(shift.date);

              return (
                <article key={shift.id} className="border-subtle rounded-[1.5rem] border p-3 sm:p-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="min-w-0 space-y-3">
                      <div className="space-y-1">
                        <div className="text-lg font-semibold text-balance text-[var(--staffly-text-strong)] sm:text-xl">
                          {shiftDate.full}
                        </div>
                        <div className="text-muted text-sm capitalize">{shiftDate.weekday}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="border-subtle text-default rounded-full border bg-[color:var(--staffly-control)] px-3 py-1.5 text-sm">
                          {shift.type === "SHIFT" ? "По смене" : "Почасовая"}
                        </span>
                      </div>

                      <div className="text-muted text-sm text-pretty sm:text-[15px]">
                        {shift.type === "SHIFT"
                          ? `Оплата за смену: ${shift.fixedAmount} ₽`
                          : `${formatTimeValue(shift.startTime)} - ${formatTimeValue(shift.endTime)} · ставка ${shift.hourlyRate} ₽/ч`}
                      </div>

                      {shift.comment && (
                        <ContentText className="text-muted rounded-2xl bg-[color:var(--staffly-control)] px-3 py-2 text-sm text-pretty">
                          {shift.comment}
                        </ContentText>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 w-full shrink-0 rounded-full px-4 text-sm sm:min-h-10 sm:w-fit sm:self-start"
                      onClick={() => onDeleteShift(shift)}
                      aria-label="Удалить смену"
                      leftIcon={<Icon icon={Trash2} size="xs" decorative />}
                    >
                      Удалить
                    </Button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                    <ShiftStat label="Доход" value={`${shift.totalIncome} ₽`} accent />
                    {shift.type === "HOURLY" ? (
                      <ShiftStat label="Часы" value={shift.hours} />
                    ) : (
                      <ShiftStat label="Часы" value="-" />
                    )}
                    <ShiftStat label="Чаевые" value={`${shift.tipsAmount ?? 0} ₽`} />
                    <ShiftStat label="Личная выручка" value={`${shift.personalRevenue ?? 0} ₽`} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl px-3 py-3", accent ? "bg-[color:var(--staffly-control)]" : "border-subtle border")}>
      <div className="text-muted text-xs">{label}</div>
      <div className="text-default text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ShiftStat({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3",
        accent ? "bg-[color:var(--staffly-control)]" : "border-subtle border",
      )}
    >
      <div className="text-muted text-xs">{label}</div>
      <div className="text-default text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function formatShiftDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return {
      full: value,
      weekday: "",
    };
  }

  const full = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);

  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(parsed);

  return { full, weekday };
}

function pluralizeShift(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "смена";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "смены";
  return "смен";
}

function calcHours(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) return 0;
  return (endMinutes - startMinutes) / 60;
}

function formatTimeValue(value?: string | null) {
  if (!value) return "—";
  const [hours, minutes] = value.split(":");
  if (!hours || !minutes) return value;
  return `${hours}:${minutes}`;
}

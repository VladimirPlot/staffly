import React from "react";
import PersonalNav from "../components/PersonalNav";
import type { IncomePeriodSummary } from "../api";
import { createIncomePeriod, deleteIncomePeriod, listIncomePeriods } from "../api";
import { Link } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import ContentText from "../../../shared/ui/ContentText";

export default function IncomeListPage() {
  const [periods, setPeriods] = React.useState<IncomePeriodSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const trimmedName = name.trim();
  const fieldCardClassName =
    "border-subtle rounded-[1.5rem] border bg-[color:var(--staffly-control)]/40 p-3 sm:bg-[color:var(--staffly-control)]/55 sm:p-4";

  React.useEffect(() => {
    (async () => {
      try {
        const data = await listIncomePeriods();
        setPeriods(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedName) return;
    setSaving(true);
    try {
      const created = await createIncomePeriod({ name: trimmedName, description: description.trim() });
      setPeriods((prev) => [created, ...prev]);
      setName("");
      setDescription("");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Удалить период вместе со сменами?")) return;
    await deleteIncomePeriod(id);
    setPeriods((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-4">
      <PersonalNav>
        <div className="text-lg font-semibold">Мои доходы</div>
      </PersonalNav>

      <section className="bg-surface rounded-2xl p-4 shadow-[var(--staffly-shadow)] sm:p-5">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <div className="text-base font-semibold text-balance text-[var(--staffly-text-strong)]">Новый период</div>
              <p className="text-muted max-w-xl text-sm leading-6 text-pretty">
                Назовите период так, как вам будет удобно находить его позже.
              </p>
            </div>
          </div>

          <form className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" onSubmit={onCreate}>
            <div className={`${fieldCardClassName} flex h-full flex-col gap-2.5 sm:justify-between sm:gap-3`}>
              <Input
                label="Название периода"
                placeholder='Например: "Сентябрь 2025"'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="flex flex-wrap gap-2">
                {['"Сентябрь 2025"', '"Подработка · Октябрь"', '"Зимний сезон 2026"'].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setName(example.replaceAll('"', ""))}
                    className="border-subtle text-default rounded-full border bg-[color:var(--staffly-control)] px-3 py-1.5 text-xs font-medium transition hover:bg-[color:var(--staffly-control-hover)] focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className={`${fieldCardClassName} flex h-full flex-col gap-2.5 sm:justify-between sm:gap-3`}>
              <Input
                label={
                  <span className="flex items-baseline gap-2">
                    <span>Описание</span>
                    <span className="text-muted text-xs">необязательно</span>
                  </span>
                }
                labelClassName="mb-2"
                placeholder="Например: Основная работа в ресторане X"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-muted text-xs leading-5 text-pretty sm:px-1">
                Короткая пометка поможет отличать похожие периоды.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-1 lg:col-span-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-muted text-sm">
                {trimmedName
                  ? `Период «${trimmedName}» будет создан ниже.`
                  : "Введите название периода, чтобы кнопка создания стала доступна."}
              </div>
              <Button type="submit" disabled={saving || !trimmedName} className="min-h-11 w-full px-5 sm:w-auto">
                {saving ? "Сохраняем..." : "+ Новый период"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {loading ? (
        <div className="text-muted text-sm">Загружаем периоды...</div>
      ) : periods.length === 0 ? (
        <div className="bg-surface text-muted rounded-2xl p-6 text-center text-sm shadow-[var(--staffly-shadow)]">
          Вы ещё не добавили ни одного периода. Создайте первый, например «Сентябрь 2025».
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {periods.map((period) => (
            <article
              key={period.id}
              className="border-subtle bg-surface rounded-[1.75rem] border p-4 shadow-[var(--staffly-shadow)] sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="text-muted text-xs">Период</div>
                  <Link
                    to={`/me/income/periods/${period.id}`}
                    className="block text-xl font-semibold text-balance text-[var(--staffly-text-strong)] hover:underline"
                  >
                    {period.name}
                  </Link>
                  {period.description ? (
                    <ContentText className="text-muted text-sm text-pretty">{period.description}</ContentText>
                  ) : (
                    <div className="text-muted text-sm">Без описания</div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => onDelete(period.id)}
                  className="w-fit shrink-0 self-start rounded-full"
                >
                  Удалить
                </Button>
              </div>

              <div className="border-subtle mt-4 border-t pt-4">
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-[color:var(--staffly-control)] px-3 py-2">
                    <div className="text-muted text-xs">Смен</div>
                    <div className="text-default text-sm font-semibold tabular-nums">{period.shiftCount}</div>
                  </div>
                  <div className="rounded-2xl bg-[color:var(--staffly-control)] px-3 py-2">
                    <div className="text-muted text-xs">Часы</div>
                    <div className="text-default text-sm font-semibold tabular-nums">{period.totalHours}</div>
                  </div>
                  <div className="rounded-2xl bg-[color:var(--staffly-control)] px-3 py-2">
                    <div className="text-muted text-xs">Доход</div>
                    <div className="text-default text-sm font-semibold tabular-nums">{period.totalIncome} ₽</div>
                  </div>
                  <div className="rounded-2xl bg-[color:var(--staffly-control)] px-3 py-2">
                    <div className="text-muted text-xs">Чаевые</div>
                    <div className="text-default text-sm font-semibold tabular-nums">{period.totalTips} ₽</div>
                  </div>

                  {Number(period.totalPersonalRevenue) > 0 && (
                    <div className="col-span-2 rounded-2xl bg-[color:var(--staffly-control)] px-3 py-2 xl:col-span-4">
                      <div className="text-muted text-xs">Личная выручка</div>
                      <div className="text-default text-sm font-semibold tabular-nums">
                        {period.totalPersonalRevenue} ₽
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

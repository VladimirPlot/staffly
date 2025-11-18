import React from "react";
import PersonalNav from "../components/PersonalNav";
import type { IncomePeriodSummary } from "../api";
import { createIncomePeriod, deleteIncomePeriod, listIncomePeriods } from "../api";
import { Link } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";

export default function IncomeListPage() {
  const [periods, setPeriods] = React.useState<IncomePeriodSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

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
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await createIncomePeriod({ name, description });
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

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-3 text-base font-medium">Новый период</div>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <Input
            label="Название"
            placeholder='Например: "Сентябрь 2025"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Описание"
            placeholder="Например: Основная работа в ресторане X"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Сохраняем..." : "+ Новый период"}
            </Button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600">Загружаем периоды...</div>
      ) : periods.length === 0 ? (
        <div className="rounded-lg bg-white p-6 text-center text-sm text-zinc-600 shadow-sm">
          Вы ещё не добавили ни одного периода. Создайте первый, например «Сентябрь 2025».
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {periods.map((period) => (
            <div key={period.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link to={`/me/income/periods/${period.id}`} className="text-lg font-semibold hover:underline">
                    {period.name}
                  </Link>
                  {period.description && <div className="text-sm text-zinc-500">{period.description}</div>}
                </div>
                <button
                  className="text-xs text-red-500 hover:underline"
                  type="button"
                  onClick={() => onDelete(period.id)}
                >
                  удалить
                </button>
              </div>
              <div className="mt-3 text-sm text-zinc-700">
                Смен: {period.shiftCount} • Часы: {period.totalHours} • Доход: {period.totalIncome} ₽ • Чаевые:
                {" "}
                {period.totalTips} ₽
                {Number(period.totalPersonalRevenue) > 0 && ` • Личная выручка: ${period.totalPersonalRevenue} ₽`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React from "react";
import Modal from "../../../shared/ui/Modal";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import type { ScheduleSummary } from "../../schedule/api";
import type { CommonSchedulePayload, CommonScheduleSummary } from "../api";
import { fitsCommonSchedulePeriod, formatScheduleDate, sortCommonScheduleCandidates } from "../utils";

type Props = {
  initial: CommonScheduleSummary | null;
  schedules: ScheduleSummary[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: CommonSchedulePayload) => void;
};

export default function CommonScheduleDialog({ initial, schedules, saving, error, onClose, onSave }: Props) {
  const candidates = React.useMemo(
    () => sortCommonScheduleCandidates(schedules.filter((s) => s.status === "PUBLISHED")),
    [schedules],
  );
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [primaryId, setPrimaryId] = React.useState<number | null>(initial?.scheduleIds[0] ?? null);
  const [additionalIds, setAdditionalIds] = React.useState<number[]>(initial?.scheduleIds.slice(1) ?? []);
  const [visible, setVisible] = React.useState(initial?.visibleToPositions ?? false);
  const primary = candidates.find((s) => s.id === primaryId);
  const selectedValid =
    primary &&
    additionalIds.length > 0 &&
    additionalIds.every((id) => {
      const source = candidates.find((s) => s.id === id);
      return source && source.id !== primary.id && fitsCommonSchedulePeriod(primary, source);
    });
  const range = (s: ScheduleSummary) => `${formatScheduleDate(s.startDate)} — ${formatScheduleDate(s.endDate)}`;

  const changePrimary = (value: string) => {
    const id = value ? Number(value) : null;
    const next = candidates.find((s) => s.id === id);
    setPrimaryId(id);
    setAdditionalIds((ids) =>
      ids.filter((candidateId) => {
        const candidate = candidates.find((s) => s.id === candidateId);
        return next && candidate && candidate.id !== next.id && fitsCommonSchedulePeriod(next, candidate);
      }),
    );
  };

  return (
    <Modal
      open
      title={initial ? "Настройки общего графика" : "Создать общий график"}
      onClose={() => {
        if (!saving) onClose();
      }}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={!title.trim() || !selectedValid}
            isLoading={saving}
            onClick={() =>
              primary &&
              onSave({
                title: title.trim(),
                scheduleIds: [primary.id, ...additionalIds],
                visibleToPositions: visible,
                version: initial?.version,
              })
            }
          >
            {initial ? "Сохранить" : "Создать"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Название"
          value={title}
          maxLength={255}
          disabled={saving}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Основной график</span>
          <DropdownSelect
            value={primaryId == null ? "" : String(primaryId)}
            disabled={saving}
            onChange={(e) => changePrimary(e.target.value)}
          >
            <option value="">Выберите основной график</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} · {range(s)}
              </option>
            ))}
          </DropdownSelect>
        </label>
        <p className="text-muted text-sm">
          Основной график задаёт период общего. Остальные должны целиком входить в этот период.
        </p>
        <fieldset disabled={saving} className="space-y-2">
          <legend className="text-strong mb-2 text-sm font-medium">Дополнительные графики</legend>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {candidates
              .filter((s) => s.id !== primaryId)
              .map((s) => {
                const compatible = primary && fitsCommonSchedulePeriod(primary, s);
                return (
                  <label
                    key={s.id}
                    className={`border-subtle flex items-start gap-3 rounded-xl border p-3 text-sm ${compatible ? "text-default" : "text-muted"}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={additionalIds.includes(s.id)}
                      disabled={!compatible}
                      onChange={(e) =>
                        setAdditionalIds((ids) => (e.target.checked ? [...ids, s.id] : ids.filter((id) => id !== s.id)))
                      }
                    />
                    <span className="min-w-0">
                      <span className="block font-medium break-words">{s.title}</span>
                      <span className="block">{range(s)}</span>
                      {!compatible && (
                        <span className="block text-xs">
                          {primary ? "Период выходит за границы основного графика" : "Сначала выберите основной график"}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
          </div>
          {candidates.length < 2 && (
            <p className="text-muted text-sm">Для создания нужны хотя бы два опубликованных графика.</p>
          )}
          {!selectedValid && <p className="text-muted text-sm">Общий график должен содержать 2 и более графиков.</p>}
        </fieldset>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={visible}
            disabled={saving}
            onChange={(e) => setVisible(e.target.checked)}
          />
          <span>
            Показывать сотрудникам выбранных должностей
            <span className="text-muted mt-1 block">
              Сотрудники этих должностей увидят общий график целиком. При выключенной настройке доступ есть только у
              Manager+.
            </span>
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

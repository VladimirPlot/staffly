import React from "react";

import Modal from "../../../shared/ui/Modal";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import { Trash2 } from "lucide-react";

import type { PositionDto } from "../../dictionaries/api";
import type { ScheduleConfig } from "../types";
import Icon from "../../../shared/ui/Icon";

type Props = {
  open: boolean;
  positions: PositionDto[];
  defaultStart?: string;
  defaultEnd?: string;
  onClose: () => void;
  onSubmit: (config: ScheduleConfig) => void;
};

type PositionField = { id: string; value: number | "" };

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

const MAX_LENGTH = 32;

const CreateScheduleDialog: React.FC<Props> = ({
  open,
  positions,
  defaultStart,
  defaultEnd,
  onClose,
  onSubmit,
}) => {
  const [startDate, setStartDate] = React.useState(defaultStart ?? "");
  const [endDate, setEndDate] = React.useState(defaultEnd ?? "");
  const [positionFields, setPositionFields] = React.useState<PositionField[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setStartDate(defaultStart ?? "");
    setEndDate(defaultEnd ?? "");
    setPositionFields([{ id: createId(), value: "" }]);
    setError(null);
  }, [open, defaultStart, defaultEnd]);

  const availablePositions = React.useMemo(() => positions.filter((p) => p.active), [positions]);

  const handleAddField = React.useCallback(() => {
    setPositionFields((prev) => [...prev, { id: createId(), value: "" }]);
  }, []);

  const handleRemoveField = React.useCallback((id: string) => {
    setPositionFields((prev) => (prev.length <= 1 ? prev : prev.filter((field) => field.id !== id)));
  }, []);

  const handleFieldChange = React.useCallback((id: string, value: string) => {
    setPositionFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, value: value ? Number(value) : "" } : field))
    );
  }, []);

  const validate = React.useCallback((): ScheduleConfig | null => {
    if (!startDate || !endDate) {
      setError("Выберите даты начала и окончания графика");
      return null;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Некорректный формат дат");
      return null;
    }
    if (start > end) {
      setError("Дата начала должна быть раньше даты окончания");
      return null;
    }
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > MAX_LENGTH) {
      setError(`График не может быть длиннее ${MAX_LENGTH} дней`);
      return null;
    }

    const selectedIds = positionFields
      .map((field) => field.value)
      .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));

    if (selectedIds.length === 0) {
      setError("Добавьте хотя бы одну должность");
      return null;
    }

    const uniqueIds = Array.from(new Set(selectedIds));
    if (uniqueIds.length !== selectedIds.length) {
      setError("Каждую должность нужно выбирать только один раз");
      return null;
    }

    const inactiveSelected = uniqueIds.some((id) => !availablePositions.some((p) => p.id === id));
    if (inactiveSelected) {
      setError("Выбрана неактивная должность");
      return null;
    }

    setError(null);
    return {
      startDate,
      endDate,
      positionIds: uniqueIds,
      showFullName: false,
      shiftMode: "FULL",
    };
  }, [startDate, endDate, positionFields, availablePositions]);

  const handleSubmit = React.useCallback(() => {
    const config = validate();
    if (!config) return;
    onSubmit(config);
    onClose();
  }, [validate, onSubmit, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать график"
      description="Настройте период, должности и формат отображения."
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Начало графика"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Окончание графика"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-default">Выберите должности</div>
          <div className="space-y-3">
            {positionFields.map((field) => (
              <div key={field.id} className="flex items-center gap-2">
                <select
                  className="flex-1 min-w-0 rounded-2xl border border-subtle p-3 text-base outline-none transition focus:ring-2 ring-default"
                  value={field.value === "" ? "" : String(field.value)}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                >
                  <option value="">Не выбрано</option>
                  {availablePositions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name}
                    </option>
                  ))}
                </select>

                {positionFields.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveField(field.id)}
                    aria-label="Удалить должность"
                    className="shrink-0 text-red-600 hover:bg-red-50"
                  >
                    <Icon icon={Trash2} />
                  </Button>
                )}
              </div>
            ))}

            <Button type="button" variant="outline" onClick={handleAddField} className="w-full sm:w-auto">
              Добавить должность
            </Button>
          </div>
        </div>

        {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={handleSubmit}>Создать</Button>
      </div>
    </Modal>
  );
};

export default CreateScheduleDialog;

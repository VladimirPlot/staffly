import React from "react";
import Modal from "../../../shared/ui/Modal";
import SelectField from "../../../shared/ui/SelectField";
import Input from "../../../shared/ui/Input";
import Button from "../../../shared/ui/Button";
import type { MasterScheduleRowDto, SalaryHandling } from "../types";

type Props = {
  row: MasterScheduleRowDto | null;
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    salaryHandling: SalaryHandling;
    rateOverride: number | null;
    amountOverride: number | null;
  }) => void;
};

export default function RowSettingsModal({ row, open, onClose, onSave }: Props) {
  const [salaryHandling, setSalaryHandling] = React.useState<SalaryHandling>("PRORATE");
  const [rateOverride, setRateOverride] = React.useState<string>("");
  const [amountOverride, setAmountOverride] = React.useState<string>("");

  React.useEffect(() => {
    if (!row) return;
    setSalaryHandling(row.salaryHandling);
    setRateOverride(row.rateOverride?.toString() ?? "");
    setAmountOverride(row.amountOverride?.toString() ?? "");
  }, [row]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Настройки строки${row ? `: ${row.positionName}` : ""}`}
      description="Переопределите ставку или итоговую сумму для этой строки."
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={() =>
              onSave({
                salaryHandling,
                rateOverride: rateOverride ? Number(rateOverride) : null,
                amountOverride: amountOverride ? Number(amountOverride) : null,
              })
            }
          >
            Сохранить
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <SelectField
          label="Обработка оклада"
          value={salaryHandling}
          onChange={(e) => setSalaryHandling(e.target.value as SalaryHandling)}
        >
          <option value="PRORATE">Пропорционально часам</option>
          <option value="FIXED">Фиксированная сумма</option>
        </SelectField>
        <Input
          label="Переопределить ставку"
          type="number"
          inputMode="decimal"
          value={rateOverride}
          onChange={(e) => setRateOverride(e.target.value)}
          placeholder="Например, 1800"
        />
        <Input
          label="Переопределить итог"
          type="number"
          inputMode="decimal"
          value={amountOverride}
          onChange={(e) => setAmountOverride(e.target.value)}
          placeholder="Например, 45000"
        />
      </div>
    </Modal>
  );
}

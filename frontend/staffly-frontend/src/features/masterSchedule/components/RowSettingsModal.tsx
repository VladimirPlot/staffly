import React from "react";
import Modal from "../../../shared/ui/Modal";
import SelectField from "../../../shared/ui/SelectField";
import Input from "../../../shared/ui/Input";
import Button from "../../../shared/ui/Button";
import type { MasterScheduleRowDto, PayType } from "../types";

type Props = {
  row: MasterScheduleRowDto | null;
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    payTypeOverride: PayType;
    rateOverride: number | null;
    amountOverride: number | null;
  }) => void;
};

export default function RowSettingsModal({ row, open, onClose, onSave }: Props) {
  const [payTypeOverride, setPayTypeOverride] = React.useState<PayType>("HOURLY");
  const [rateOverride, setRateOverride] = React.useState<string>("");
  const [amountOverride, setAmountOverride] = React.useState<string>("");

  React.useEffect(() => {
    if (!row) return;
    setPayTypeOverride(row.payType);
    setRateOverride(row.rateOverride?.toString() ?? "");
    setAmountOverride(row.amountOverride?.toString() ?? "");
  }, [row]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Настройки строки${row ? `: ${row.positionName}` : ""}`}
      description="Переопределите тип оплаты, ставку или итоговую сумму для этой строки."
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={() =>
              onSave({
                payTypeOverride,
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
          label="Тип оплаты"
          value={payTypeOverride}
          onChange={(e) => setPayTypeOverride(e.target.value as PayType)}
        >
          <option value="HOURLY">Почасовая</option>
          <option value="SHIFT">Сменная</option>
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

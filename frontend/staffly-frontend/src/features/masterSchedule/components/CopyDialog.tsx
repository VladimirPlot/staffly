import React from "react";
import Modal from "../../../shared/ui/Modal";
import Input from "../../../shared/ui/Input";
import Button from "../../../shared/ui/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  onCopyDay: (source: string, target: string) => void;
  onCopyWeek: (source: string, target: string) => void;
  minDate: string;
  maxDate: string;
};

export default function CopyDialog({
  open,
  onClose,
  onCopyDay,
  onCopyWeek,
  minDate,
  maxDate,
}: Props) {
  const [sourceDay, setSourceDay] = React.useState(minDate);
  const [targetDay, setTargetDay] = React.useState(minDate);
  const [sourceWeek, setSourceWeek] = React.useState(minDate);
  const [targetWeek, setTargetWeek] = React.useState(minDate);

  React.useEffect(() => {
    if (!open) return;
    setSourceDay(minDate);
    setTargetDay(minDate);
    setSourceWeek(minDate);
    setTargetWeek(minDate);
  }, [open, minDate]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Копирование"
      description="Выберите источник и цель для копирования значений."
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="mb-3 text-sm font-medium">Copy day → day</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Источник"
              type="date"
              min={minDate}
              max={maxDate}
              value={sourceDay}
              onChange={(e) => setSourceDay(e.target.value)}
            />
            <Input
              label="Цель"
              type="date"
              min={minDate}
              max={maxDate}
              value={targetDay}
              onChange={(e) => setTargetDay(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <Button onClick={() => onCopyDay(sourceDay, targetDay)}>Копировать день</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="mb-3 text-sm font-medium">Copy week → week</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Источник (понедельник)"
              type="date"
              min={minDate}
              max={maxDate}
              value={sourceWeek}
              onChange={(e) => setSourceWeek(e.target.value)}
            />
            <Input
              label="Цель (понедельник)"
              type="date"
              min={minDate}
              max={maxDate}
              value={targetWeek}
              onChange={(e) => setTargetWeek(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <Button onClick={() => onCopyWeek(sourceWeek, targetWeek)}>Копировать неделю</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

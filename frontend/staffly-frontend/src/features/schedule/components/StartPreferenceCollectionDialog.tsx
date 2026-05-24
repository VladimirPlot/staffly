import React from "react";

import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";

type StartPreferenceCollectionDialogProps = {
  open: boolean;
  deadline: string;
  error: string | null;
  saving: boolean;
  onDeadlineChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const StartPreferenceCollectionDialog: React.FC<StartPreferenceCollectionDialogProps> = ({
  open,
  deadline,
  error,
  saving,
  onDeadlineChange,
  onClose,
  onSubmit,
}) => {
  const handleClose = React.useCallback(() => {
    if (saving) return;
    onClose();
  }, [onClose, saving]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Собрать пожелания"
      description="Укажите дедлайн, до которого сотрудники смогут отправить пожелания по графику."
      className="max-w-md"
      footer={
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving} className="w-full">
            Отмена
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="w-full">
            {saving ? "Запуск…" : "Запустить"}
          </Button>
        </div>
      }
    >
      <Input
        label="Дедлайн сбора"
        type="datetime-local"
        value={deadline}
        onChange={(event) => onDeadlineChange(event.target.value)}
        error={error ?? undefined}
        required
      />
    </Modal>
  );
};

export default StartPreferenceCollectionDialog;

import React from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import type { ScheduleBuildTemplateDto } from "../api";

type StartPreferenceCollectionDialogProps = {
  open: boolean;
  deadline: string;
  buildTemplateId: string;
  buildTemplates: ScheduleBuildTemplateDto[];
  templatesLoading: boolean;
  error: string | null;
  templateError: string | null;
  saving: boolean;
  onDeadlineChange: (value: string) => void;
  onBuildTemplateChange: (value: string) => void;
  onLoadTemplates: () => void;
  onClose: () => void;
  onSubmit: () => void;
};

const StartPreferenceCollectionDialog: React.FC<StartPreferenceCollectionDialogProps> = ({
  open,
  deadline,
  buildTemplateId,
  buildTemplates,
  templatesLoading,
  error,
  templateError,
  saving,
  onDeadlineChange,
  onBuildTemplateChange,
  onLoadTemplates,
  onClose,
  onSubmit,
}) => {
  React.useEffect(() => {
    if (open) {
      onLoadTemplates();
    }
  }, [onLoadTemplates, open]);

  const handleClose = React.useCallback(() => {
    if (saving) return;
    onClose();
  }, [onClose, saving]);

  const activeTemplates = buildTemplates.filter((template) => template.isActive);
  const hasActiveTemplates = activeTemplates.length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Собрать пожелания"
      description="Укажите дедлайн и шаблон, из которого сотрудники будут выбирать интервалы смен."
      className="max-w-md"
      footer={
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving} className="w-full">
            Отмена
          </Button>
          <Button
            onClick={onSubmit}
            disabled={saving || templatesLoading || !hasActiveTemplates}
            className="w-full"
          >
            {saving ? "Запуск…" : "Запустить"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Дедлайн сбора"
          type="datetime-local"
          value={deadline}
          onChange={(event) => onDeadlineChange(event.target.value)}
          error={error ?? undefined}
          required
        />
        <DropdownSelect
          label="Шаблон для пожеланий"
          value={buildTemplateId}
          onChange={(event) => onBuildTemplateChange(event.target.value)}
          disabled={saving || templatesLoading || !hasActiveTemplates}
          error={templateError ?? undefined}
          required
        >
          <option value="" disabled>
            Выберите шаблон
          </option>
          {activeTemplates.map((template) => (
            <option key={template.id} value={String(template.id)}>
              {template.name}
            </option>
          ))}
        </DropdownSelect>
        {!templatesLoading && !hasActiveTemplates ? (
          <p className="text-sm text-red-600">
            Сначала создайте активный шаблон сборки. Без него начать сбор пожеланий нельзя.
          </p>
        ) : (
          <p className="text-muted text-xs">
            Сотрудник сможет указать точное время только из вариантов смен для своей должности.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default StartPreferenceCollectionDialog;

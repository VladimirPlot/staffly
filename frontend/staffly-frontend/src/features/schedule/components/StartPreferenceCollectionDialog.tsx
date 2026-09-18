import React from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import type { ScheduleBuildTemplateDto } from "../api";

type StartPreferenceCollectionDialogProps = {
  open: boolean;
  deadline: string;
  mode: "DAY_LEVEL" | "SHIFT_OPTIONS";
  buildTemplateId: string;
  buildTemplates: ScheduleBuildTemplateDto[];
  templatesLoading: boolean;
  error: string | null;
  templateError: string | null;
  saving: boolean;
  onDeadlineChange: (value: string) => void;
  onModeChange: (value: "DAY_LEVEL" | "SHIFT_OPTIONS") => void;
  onBuildTemplateChange: (value: string) => void;
  onLoadTemplates: () => void;
  onClose: () => void;
  onSubmit: () => void;
};

const StartPreferenceCollectionDialog: React.FC<StartPreferenceCollectionDialogProps> = ({
  open,
  deadline,
  mode,
  buildTemplateId,
  buildTemplates,
  templatesLoading,
  error,
  templateError,
  saving,
  onDeadlineChange,
  onModeChange,
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
      description="Укажите дедлайн и выберите, как сотрудники смогут оставить пожелания."
      className="max-w-md"
      footer={
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving} className="w-full">
            Отмена
          </Button>
          <Button
            onClick={onSubmit}
            disabled={saving || (mode === "SHIFT_OPTIONS" && (templatesLoading || !hasActiveTemplates))}
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
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Как сотрудники смогут оставить пожелания?</legend>
          <label className="flex cursor-pointer gap-3 rounded-xl border p-3">
            <input type="radio" name="preference-mode" checked={mode === "DAY_LEVEL"}
              onChange={() => onModeChange("DAY_LEVEL")} disabled={saving} />
            <span><span className="block text-sm font-medium">Без выбора времени</span>
              <span className="text-muted block text-xs">Только пожелание на день: могу работать, не могу работать, предпочитаю выходной или без пожеланий.</span></span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-xl border p-3">
            <input type="radio" name="preference-mode" checked={mode === "SHIFT_OPTIONS"}
              onChange={() => onModeChange("SHIFT_OPTIONS")} disabled={saving} />
            <span><span className="block text-sm font-medium">С вариантами смен</span>
              <span className="text-muted block text-xs">Для «Могу работать» можно выбрать смену из шаблона сборки.</span></span>
          </label>
        </fieldset>
        {mode === "SHIFT_OPTIONS" && <DropdownSelect
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
        </DropdownSelect>}
        {mode === "SHIFT_OPTIONS" && !templatesLoading && !hasActiveTemplates ? (
          <p className="text-sm text-red-600">
            Сначала создайте активный шаблон сборки. Без него начать сбор пожеланий нельзя.
          </p>
        ) : mode === "SHIFT_OPTIONS" ? (
          <p className="text-muted text-xs">
            Сотрудник сможет указать точное время только из вариантов смен для своей должности.
          </p>
        ) : null}
      </div>
    </Modal>
  );
};

export default StartPreferenceCollectionDialog;

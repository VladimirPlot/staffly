import React from "react";

import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import Textarea from "../../../shared/ui/Textarea";
import type { PositionDto } from "../../dictionaries/api";
import type { SaveScheduleBuildTemplateRequest, ScheduleBuildTemplateDto } from "../api";
import {
  createPositionConfigDraft,
  draftToSaveRequest,
  templateDtoToDraft,
  type ScheduleBuildTemplateDraft,
  validateBuildTemplateDraft,
} from "../utils/buildTemplateDraft";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";
import ScheduleBuildPositionConfigCard from "./ScheduleBuildPositionConfigCard";

type Props = {
  open: boolean;
  template: ScheduleBuildTemplateDto | null;
  positions: PositionDto[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (req: SaveScheduleBuildTemplateRequest, id?: number) => Promise<ScheduleBuildTemplateDto | null>;
};

const ScheduleBuildTemplateDialog: React.FC<Props> = ({ open, template, positions, saving, onClose, onSubmit }) => {
  const [draft, setDraft] = React.useState<ScheduleBuildTemplateDraft>({
    name: "",
    description: "",
    positionConfigs: [createPositionConfigDraft()],
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDraft(templateDtoToDraft(template));
    setError(null);
  }, [open, template]);

  const submit = async () => {
    const message = validateBuildTemplateDraft(draft);
    if (message) {
      setError(message);
      return;
    }

    setError(null);
    try {
      const result = await onSubmit(draftToSaveRequest(draft), template?.id);
      if (result !== null) {
        onClose();
      } else {
        setError("Не удалось сохранить шаблон");
      }
    } catch (e: unknown) {
      setError(getFriendlyScheduleErrorMessage(e, "Не удалось сохранить шаблон"));
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={template ? "Редактировать шаблон" : "Создать шаблон"}
      description="MVP настройки сборки графика"
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <Input
          label="Название"
          value={draft.name}
          disabled={saving}
          onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
        />
        <Textarea
          label="Описание"
          value={draft.description}
          disabled={saving}
          onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
        />
        {draft.positionConfigs.map((config, idx) => (
          <ScheduleBuildPositionConfigCard
            key={idx}
            index={idx}
            config={config}
            positions={positions}
            saving={saving}
            onChange={(next) =>
              setDraft((prev) => ({
                ...prev,
                positionConfigs: prev.positionConfigs.map((item, itemIdx) => (itemIdx === idx ? next : item)),
              }))
            }
            onRemove={() =>
              setDraft((prev) => ({
                ...prev,
                positionConfigs: prev.positionConfigs.filter((_, itemIdx) => itemIdx !== idx),
              }))
            }
          />
        ))}
        <Button
          variant="outline"
          disabled={saving}
          onClick={() =>
            setDraft((prev) => ({ ...prev, positionConfigs: [...prev.positionConfigs, createPositionConfigDraft()] }))
          }
        >
          Добавить должность
        </Button>
        {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" disabled={saving} onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>
    </Modal>
  );
};

export default ScheduleBuildTemplateDialog;

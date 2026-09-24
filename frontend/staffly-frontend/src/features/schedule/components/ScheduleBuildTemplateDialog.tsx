import React from "react";

import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import Textarea from "../../../shared/ui/Textarea";
import type { PositionDto } from "../../dictionaries/api";
import type {
  SaveScheduleBuildTemplateRequest,
  ScheduleBuildTemplateConfirmationMeta,
  ScheduleBuildTemplateDto,
} from "../api";
import {
  createPositionConfigDraft,
  draftToSaveRequest,
  templateDtoToDraft,
  type ScheduleBuildTemplateDraft,
  validateBuildTemplateDraft,
} from "../utils/buildTemplateDraft";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";
import {
  getScheduleActionMessage,
  getTemplateConfirmationMeta,
  getTemplateErrorCode,
  TEMPLATE_VERSION_CONFLICT,
} from "../utils/buildTemplateConfirmation";
import ScheduleBuildPositionConfigCard from "./ScheduleBuildPositionConfigCard";

type Props = {
  open: boolean;
  template: ScheduleBuildTemplateDto | null;
  positions: PositionDto[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (req: SaveScheduleBuildTemplateRequest, id?: number) => Promise<ScheduleBuildTemplateDto | null>;
  timeZone: string;
};

const ScheduleBuildTemplateDialog: React.FC<Props> = ({
  open,
  template,
  positions,
  saving,
  onClose,
  onSubmit,
  timeZone,
}) => {
  const [draft, setDraft] = React.useState<ScheduleBuildTemplateDraft>({
    name: "",
    description: "",
    positionConfigs: [createPositionConfigDraft()],
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = React.useState<{
    request: SaveScheduleBuildTemplateRequest;
    meta: ScheduleBuildTemplateConfirmationMeta;
  } | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const submittingRef = React.useRef(false);
  const confirmingRef = React.useRef(false);

  const clearPendingConfirmation = React.useCallback(() => {
    setPendingConfirmation(null);
    setConfirming(false);
    confirmingRef.current = false;
  }, []);

  React.useEffect(() => {
    if (!open) {
      clearPendingConfirmation();
      submittingRef.current = false;
      return;
    }
    setDraft(templateDtoToDraft(template));
    setError(null);
    clearPendingConfirmation();
  }, [clearPendingConfirmation, open, template]);

  const submit = async () => {
    if (submittingRef.current || saving || pendingConfirmation) return;
    const message = validateBuildTemplateDraft(draft);
    if (message) {
      setError(message);
      return;
    }

    const draftRequest = draftToSaveRequest(draft);
    const request: SaveScheduleBuildTemplateRequest = template
      ? { ...draftRequest, expectedVersion: template.version, confirmConsequences: false }
      : draftRequest;
    submittingRef.current = true;
    setError(null);
    try {
      const result = await onSubmit(request, template?.id);
      if (result !== null) {
        onClose();
      } else {
        setError("Не удалось сохранить шаблон");
      }
    } catch (e: unknown) {
      const confirmationMeta = template ? getTemplateConfirmationMeta(e) : null;
      if (confirmationMeta) {
        setPendingConfirmation({ request, meta: confirmationMeta });
      } else {
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось сохранить шаблон"));
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const confirmConsequences = async () => {
    if (!template || !pendingConfirmation || confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    setError(null);
    try {
      const result = await onSubmit({ ...pendingConfirmation.request, confirmConsequences: true }, template.id);
      if (result !== null) {
        clearPendingConfirmation();
        onClose();
      } else {
        setError("Не удалось сохранить шаблон");
      }
    } catch (e: unknown) {
      if (getTemplateErrorCode(e) === TEMPLATE_VERSION_CONFLICT) {
        clearPendingConfirmation();
      }
      setError(getFriendlyScheduleErrorMessage(e, "Не удалось сохранить шаблон"));
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  const closeEditor = () => {
    if (saving || confirming || submittingRef.current || confirmingRef.current) return;
    clearPendingConfirmation();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        closeEditor();
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
            timeZone={timeZone}
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
        <Button variant="outline" disabled={saving} onClick={closeEditor}>
          Отмена
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>
      <ConfirmDialog
        open={pendingConfirmation !== null}
        title="Подтвердите последствия изменения"
        description={
          pendingConfirmation && (
            <div className="space-y-3 text-left">
              <p>
                Изменение затронет графики: {pendingConfirmation.meta.summary.linkedScheduleCount}. Проверьте
                последствия перед сохранением.
              </p>
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {pendingConfirmation.meta.schedules.map((schedule) => (
                  <li key={schedule.scheduleId} className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="font-medium text-red-900">{schedule.scheduleTitle}</div>
                    <div className="mt-1 text-sm text-red-800">{getScheduleActionMessage(schedule.action)}</div>
                  </li>
                ))}
              </ul>
              {error && <div className="rounded-xl bg-red-100 p-3 text-sm text-red-800">{error}</div>}
            </div>
          )
        }
        confirmText="Изменить шаблон"
        cancelText="Отмена"
        tone="danger"
        confirming={confirming}
        onCancel={clearPendingConfirmation}
        onConfirm={() => void confirmConsequences()}
      />
    </Modal>
  );
};

export default ScheduleBuildTemplateDialog;

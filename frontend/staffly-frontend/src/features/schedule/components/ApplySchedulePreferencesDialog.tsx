import React from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Modal from "../../../shared/ui/Modal";
import type { ScheduleBuildTemplateDto } from "../api";

type ApplySchedulePreferencesDialogProps = {
  open: boolean;
  applying: boolean;
  templates: ScheduleBuildTemplateDto[];
  templatesLoading: boolean;
  templatesError: string | null;
  onReloadTemplates: () => void;
  onClose: () => void;
  onApplyManual: () => void;
};

const ApplySchedulePreferencesDialog: React.FC<ApplySchedulePreferencesDialogProps> = ({
  open,
  applying,
  templates,
  templatesLoading,
  templatesError,
  onReloadTemplates,
  onClose,
  onApplyManual,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) return;
    if (templates.length === 0 || selectedTemplateId) return;
    setSelectedTemplateId(String(templates[0].id));
  }, [open, selectedTemplateId, templates]);

  const handleClose = React.useCallback(() => {
    if (applying) return;
    onClose();
  }, [applying, onClose]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Подготовить черновик графика"
      description="Выберите, как перейти от закрытых пожеланий к подготовке черновика."
      className="max-w-2xl"
      footer={
        <div className="flex w-full justify-end">
          <Button variant="outline" onClick={handleClose} disabled={applying}>
            Закрыть
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="border-subtle bg-app rounded-2xl border p-4">
          <h3 className="text-default text-sm font-semibold">Ручной режим</h3>
          <p className="text-muted mt-2 text-sm">
            Пожелания сотрудников будут показаны подсказками в таблице. Смены менеджер расставляет вручную.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={onApplyManual} disabled={applying}>
              {applying ? "Подготовка…" : "Продолжить вручную"}
            </Button>
          </div>
        </section>

        <section className="border-subtle rounded-2xl border border-dashed p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-default text-sm font-semibold">Автоматический режим</h3>
            <span className="bg-app text-muted rounded-full px-2 py-0.5 text-xs">Следующий этап</span>
          </div>
          <p className="text-muted mt-2 text-sm">
            Выберите шаблон сборки. Автосборка рассчитает смены по правилам покрытия, вариантам смен и пожеланиям
            сотрудников.
          </p>

          <div className="mt-3 space-y-2">
            {templates.length > 0 ? (
              <DropdownSelect
                label="Шаблон сборки"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                disabled={applying || templatesLoading}
              >
                {templates.map((template) => (
                  <option key={template.id} value={String(template.id)}>
                    {template.name}
                  </option>
                ))}
              </DropdownSelect>
            ) : (
              <div className="bg-app text-muted rounded-xl px-3 py-2 text-sm">
                Сначала создайте шаблон в блоке «Настройки сборки»
              </div>
            )}

            {templatesError && <div className="text-sm text-red-700">{templatesError}</div>}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button variant="outline" onClick={onReloadTemplates} disabled={applying || templatesLoading}>
                {templatesLoading ? "Загрузка…" : "Обновить шаблоны"}
              </Button>
              <Button disabled>Собрать автоматически</Button>
              <span className="text-muted text-xs">Алгоритм автосборки будет подключён следующим этапом</span>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
};

export default ApplySchedulePreferencesDialog;

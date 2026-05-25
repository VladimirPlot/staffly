import React from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Modal from "../../../shared/ui/Modal";
import type { ScheduleAutoBuildPreviewResponse, ScheduleBuildTemplateDto } from "../api";

type ApplySchedulePreferencesDialogProps = {
  open: boolean;
  applying: boolean;
  previewLoading: boolean;
  previewError: string | null;
  preview: ScheduleAutoBuildPreviewResponse | null;
  templates: ScheduleBuildTemplateDto[];
  templatesLoading: boolean;
  templatesError: string | null;
  onReloadTemplates: () => void;
  onClose: () => void;
  onApplyManual: () => void;
  onPreviewAutoBuild: (templateId: number) => Promise<boolean> | boolean;
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
  previewLoading,
  previewError,
  preview,
  onPreviewAutoBuild,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) return;
    if (templates.length === 0 || selectedTemplateId) return;
    setSelectedTemplateId(String(templates[0].id));
  }, [open, selectedTemplateId, templates]);

  const [templateError, setTemplateError] = React.useState<string | null>(null);

  const handlePreview = React.useCallback(() => {
    if (!selectedTemplateId) {
      setTemplateError("Выберите настройку сборки");
      return;
    }
    setTemplateError(null);
    void onPreviewAutoBuild(Number(selectedTemplateId));
  }, [onPreviewAutoBuild, selectedTemplateId]);

  const handleClose = React.useCallback(() => {
    if (applying || previewLoading) return;
    onClose();
  }, [applying, onClose, previewLoading]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Подготовить черновик графика"
      description="Выберите, как перейти от закрытых пожеланий к подготовке черновика."
      className="max-w-2xl"
      footer={
        <div className="flex w-full justify-end">
          <Button variant="outline" onClick={handleClose} disabled={applying || previewLoading}>
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
            <Button onClick={onApplyManual} disabled={applying || previewLoading}>
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
                disabled={applying || templatesLoading || previewLoading}
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
            {templateError && <div className="text-sm text-red-700">{templateError}</div>}
            {previewError && <div className="text-sm text-red-700">{previewError}</div>}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="outline"
                onClick={onReloadTemplates}
                disabled={applying || templatesLoading || previewLoading}
              >
                {templatesLoading ? "Загрузка…" : "Обновить шаблоны"}
              </Button>
              <Button
                onClick={handlePreview}
                disabled={applying || previewLoading || templatesLoading || templates.length === 0}
              >
                {previewLoading ? "Строим…" : "Построить предпросмотр"}
              </Button>
              <Button disabled>Применить автоматически</Button>
              <span className="text-muted text-xs">Применение будет добавлено следующим шагом</span>
            </div>
          </div>
        </section>

        {preview && (
          <section className="border-subtle bg-app rounded-2xl border p-4">
            <h3 className="text-default text-sm font-semibold">Предпросмотр автосборки</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div>Назначений: {preview.totalAssignments}</div>
              <div>Незаполнено: {preview.unfilledCount}</div>
              <div>Предупреждений: {preview.warningsCount}</div>
              <div>Назначений вопреки пожеланиям: {preview.negativeAssignmentsCount}</div>
            </div>
            {preview.warnings.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-700">
                {preview.warnings.map((warning, idx) => (
                  <li key={`top-warning-${idx}`}>{warning}</li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-4">
              {preview.positions.map((position) => (
                <div key={position.positionId} className="border-subtle rounded-xl border p-3">
                  <div className="text-sm font-semibold">{position.positionName}</div>
                  <div className="text-muted mt-1 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <div>Назначений: {position.totalAssignments}</div>
                    <div>Незаполнено: {position.unfilledCount}</div>
                    <div>Предупреждений: {position.warningsCount}</div>
                    <div>Вопреки пожеланиям: {position.negativeAssignmentsCount}</div>
                  </div>
                  {position.warnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">
                      {position.warnings.map((warning, idx) => (
                        <li key={`${position.positionId}-warning-${idx}`}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-muted">
                          <th className="pr-2">Дата</th>
                          <th className="pr-2">Сотрудник</th>
                          <th className="pr-2">Смена</th>
                          <th className="pr-2">Shift label</th>
                          <th className="pr-2">Причина</th>
                          <th>Warnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {position.cells.map((cell, idx) => (
                          <tr
                            key={`${position.positionId}-${cell.day}-${cell.memberId ?? "none"}-${idx}`}
                            className="align-top"
                          >
                            <td className="py-1 pr-2">{cell.day}</td>
                            <td className="py-1 pr-2">{cell.memberName ?? "—"}</td>
                            <td className="py-1 pr-2">{cell.value ?? "—"}</td>
                            <td className="py-1 pr-2">{cell.shiftLabel ?? "—"}</td>
                            <td className="py-1 pr-2">{cell.reason ?? "—"}</td>
                            <td className="py-1">{cell.warnings.join("; ") || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
};

export default ApplySchedulePreferencesDialog;

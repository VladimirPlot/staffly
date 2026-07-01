import React from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Modal from "../../../shared/ui/Modal";
import type {
  ScheduleAutoBuildCellPreviewDto,
  ScheduleAutoBuildPreviewResponse,
  ScheduleBuildTemplateDto,
} from "../api";
import type { ScheduleStatus } from "../types";

type ApplySchedulePreferencesDialogProps = {
  open: boolean;
  scheduleStatus?: ScheduleStatus;
  preferenceBuildTemplateId?: number | null;
  applying: boolean;
  autoApplying: boolean;
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
  onApplyAutoBuild: (templateId: number) => Promise<boolean> | void;
};

type PreviewCellsByDay = Array<{
  day: string;
  cells: ScheduleAutoBuildCellPreviewDto[];
}>;

const groupPreviewCellsByDay = (cells: ScheduleAutoBuildCellPreviewDto[]): PreviewCellsByDay => {
  const groups = new Map<string, ScheduleAutoBuildCellPreviewDto[]>();

  cells.forEach((cell) => {
    const dayCells = groups.get(cell.day) ?? [];
    dayCells.push(cell);
    groups.set(cell.day, dayCells);
  });

  return Array.from(groups.entries()).map(([day, dayCells]) => ({ day, cells: dayCells }));
};

const hasPreviewRisks = (preview: ScheduleAutoBuildPreviewResponse | null): boolean =>
  Boolean(
    preview &&
      (preview.totalAssignments === 0 ||
        preview.warningsCount > 0 ||
        preview.unfilledCount > 0 ||
        preview.negativeAssignmentsCount > 0),
  );

const getPreviewApplyHint = (preview: ScheduleAutoBuildPreviewResponse | null): string => {
  if (!preview) return "Постройте предпросмотр, чтобы применить автосборку.";
  if (preview.totalAssignments === 0) {
    return "Автосборка не создала назначений. Проверьте правила покрытия и варианты смен.";
  }
  if (preview.warningsCount > 0) return "Предпросмотр содержит предупреждения. Проверьте детали перед применением.";
  if (hasPreviewRisks(preview)) return "Можно применить, но после этого проверьте проблемные места вручную.";
  return "Предпросмотр без критичных предупреждений.";
};

const SummaryCounter: React.FC<{ label: string; value: number; tone?: "default" | "warning" }> = ({
  label,
  value,
  tone = "default",
}) => (
  <div
    className={`rounded-xl border px-3 py-2 ${
      tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-subtle bg-card text-default"
    }`}
  >
    <div className="text-muted text-xs">{label}</div>
    <div className="mt-1 text-lg font-semibold">{value}</div>
  </div>
);

const WarningBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{children}</div>
);

const ApplySchedulePreferencesDialog: React.FC<ApplySchedulePreferencesDialogProps> = ({
  open,
  scheduleStatus,
  preferenceBuildTemplateId,
  applying,
  autoApplying,
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
  onApplyAutoBuild,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");
  const isDraftFromPreferences = scheduleStatus === "DRAFT_FROM_PREFERENCES";
  const lockedTemplateId = preferenceBuildTemplateId ?? null;
  const isTemplateLocked = lockedTemplateId != null;

  React.useEffect(() => {
    if (!open) return;
    if (isTemplateLocked) {
      setSelectedTemplateId(String(lockedTemplateId));
      return;
    }
    if (templates.length === 0 || selectedTemplateId) return;
    setSelectedTemplateId(String(templates[0].id));
  }, [isTemplateLocked, lockedTemplateId, open, selectedTemplateId, templates]);

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
    if (applying || previewLoading || autoApplying) return;
    onClose();
  }, [applying, autoApplying, onClose, previewLoading]);

  const selectedTemplateNumericId = selectedTemplateId ? Number(selectedTemplateId) : null;
  const effectivePreviewTemplateId = preview?.effectiveBuildTemplateId ?? preview?.templateId ?? null;
  const previewMatchesSelectedTemplate =
    selectedTemplateNumericId != null && effectivePreviewTemplateId === selectedTemplateNumericId;
  const canApplyAutoBuild =
    Boolean(selectedTemplateId) &&
    Boolean(preview) &&
    previewMatchesSelectedTemplate &&
    (preview?.totalAssignments ?? 0) > 0 &&
    !applying &&
    !previewLoading &&
    !autoApplying;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Сборка по пожеланиям"
      description={
        isDraftFromPreferences
          ? "Продолжайте ручную сборку или запустите автосборку по собранным пожеланиям."
          : "Выберите, как перейти от закрытых пожеланий к подготовке черновика."
      }
      className="max-w-2xl"
      footer={
        <div className="flex w-full justify-end">
          <Button variant="outline" onClick={handleClose} disabled={applying || previewLoading || autoApplying}>
            Закрыть
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!isDraftFromPreferences && (
          <section className="border-subtle bg-app rounded-2xl border p-4">
            <h3 className="text-default text-sm font-semibold">Ручной режим</h3>
            <p className="text-muted mt-2 text-sm">
              Пожелания сотрудников будут показаны подсказками в таблице. Смены менеджер расставляет вручную.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={onApplyManual} disabled={applying || previewLoading || autoApplying}>
                {applying ? "Подготовка…" : "Продолжить вручную"}
              </Button>
            </div>
          </section>
        )}

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
                disabled={applying || templatesLoading || previewLoading || autoApplying || isTemplateLocked}
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

            {isTemplateLocked && (
              <div className="text-muted text-sm">Автосборка использует шаблон, выбранный при сборе пожеланий.</div>
            )}
            {templatesError && <div className="text-sm text-red-700">{templatesError}</div>}
            {templateError && <div className="text-sm text-red-700">{templateError}</div>}
            {previewError && <div className="text-sm text-red-700">{previewError}</div>}

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              При применении будут перезаписаны ячейки только по должностям из выбранного шаблона и только в периоде
              текущего графика. Остальные должности и даты не будут затронуты.
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="outline"
                onClick={onReloadTemplates}
                disabled={applying || templatesLoading || previewLoading || autoApplying}
              >
                {templatesLoading ? "Загрузка…" : "Обновить шаблоны"}
              </Button>
              <Button
                onClick={handlePreview}
                disabled={applying || previewLoading || templatesLoading || templates.length === 0 || autoApplying}
              >
                {previewLoading ? "Строим…" : "Построить предпросмотр"}
              </Button>
              <Button
                onClick={() => {
                  const templateId =
                    preview?.effectiveBuildTemplateId ?? preview?.templateId ?? selectedTemplateNumericId;
                  if (templateId) void onApplyAutoBuild(templateId);
                }}
                disabled={!canApplyAutoBuild}
              >
                {autoApplying ? "Применение…" : "Применить автосборку"}
              </Button>
              <span className={`text-xs ${hasPreviewRisks(preview) ? "text-amber-700" : "text-muted"}`}>
                {preview && !previewMatchesSelectedTemplate
                  ? "Предпросмотр построен для другого шаблона. Постройте новый предпросмотр."
                  : getPreviewApplyHint(preview)}
              </span>
            </div>
          </div>
        </section>

        {preview && (
          <section className="border-subtle bg-app rounded-2xl border p-4">
            <h3 className="text-default text-sm font-semibold">Предпросмотр автосборки</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <SummaryCounter label="Назначений" value={preview.totalAssignments} />
              <SummaryCounter label="Незаполнено" value={preview.unfilledCount} tone="warning" />
              <SummaryCounter label="Предупреждений" value={preview.warningsCount} tone="warning" />
              <SummaryCounter label="Вопреки пожеланиям" value={preview.negativeAssignmentsCount} tone="warning" />
            </div>
            <div className="mt-3 space-y-2">
              {preview.unfilledCount > 0 && (
                <WarningBox>Не все потребности закрыты. После применения проверьте пустые места вручную.</WarningBox>
              )}
              {preview.uncoveredSlots.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <div className="font-semibold">Не закрыто</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {preview.uncoveredSlots.map((slot, idx) => (
                      <li key={`${slot.date}-${slot.positionId}-${slot.startTime}-${slot.endTime}-${idx}`}>
                        {slot.date}, {slot.startTime}–{slot.endTime}: не хватает{" "}
                        {Math.max(slot.requiredCount - slot.assignedCount, 0)} из {slot.requiredCount}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.negativeAssignmentsCount > 0 && (
                <WarningBox>Есть назначения вопреки отрицательным пожеланиям сотрудников.</WarningBox>
              )}
              {preview.totalAssignments === 0 && (
                <WarningBox>
                  Автосборка не создала ни одного назначения. Проверьте настройки покрытия и варианты смен.
                </WarningBox>
              )}
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
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <SummaryCounter label="Назначений" value={position.totalAssignments} />
                    <SummaryCounter label="Незаполнено" value={position.unfilledCount} tone="warning" />
                    <SummaryCounter label="Предупреждений" value={position.warningsCount} tone="warning" />
                    <SummaryCounter
                      label="Вопреки пожеланиям"
                      value={position.negativeAssignmentsCount}
                      tone="warning"
                    />
                  </div>
                  {position.warnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">
                      {position.warnings.map((warning, idx) => (
                        <li key={`${position.positionId}-warning-${idx}`}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 space-y-3">
                    {groupPreviewCellsByDay(position.cells).map((dayGroup) => (
                      <div key={`${position.positionId}-${dayGroup.day}`} className="rounded-xl bg-white/60 p-3">
                        <div className="text-default text-xs font-semibold">{dayGroup.day}</div>
                        <div className="mt-2 space-y-2">
                          {dayGroup.cells.map((cell, idx) => (
                            <div
                              key={`${position.positionId}-${cell.day}-${cell.memberId ?? "none"}-${idx}`}
                              className="border-subtle rounded-lg border bg-white px-3 py-2 text-xs"
                            >
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-medium">{cell.memberName ?? "Не назначено"}</span>
                                <span className="text-muted">—</span>
                                <span>{cell.shiftLabel ?? cell.value ?? "Смена не указана"}</span>
                                <span className="text-muted">—</span>
                                <span className="text-muted">{cell.reason ?? "Причина не указана"}</span>
                              </div>
                              {cell.warnings.length > 0 && (
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-700">
                                  {cell.warnings.map((warning, warningIdx) => (
                                    <li key={`${position.positionId}-${cell.day}-${idx}-warning-${warningIdx}`}>
                                      {warning}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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

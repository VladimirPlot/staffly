import React from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Modal from "../../../shared/ui/Modal";
import type {
  AdjustedScheduleAutoBuildAssignment,
  ScheduleAutoBuildCellPreviewDto,
  ScheduleAutoBuildPreviewResponse,
  ScheduleAutoBuildUncoveredSlotDto,
  ScheduleBuildTemplateDto,
} from "../api";
import type { MemberDto } from "../../employees/api";
import { buildMemberDisplayNameMap, memberDisplayName } from "../utils/names";
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
  members: MemberDto[];
  onReloadTemplates: () => void;
  onClose: () => void;
  onApplyManual: () => void;
  onPreviewAutoBuild: (templateId: number) => Promise<boolean> | boolean;
  onApplyAutoBuild: (
    templateId: number,
    adjustedAssignments?: AdjustedScheduleAutoBuildAssignment[],
  ) => Promise<boolean> | void;
};

type EditableAssignment = ScheduleAutoBuildCellPreviewDto & {
  id: string;
  positionConfigId: number;
  positionId: number;
  positionIds: number[];
};

const isMemberInPositionIds = (member: MemberDto, positionIds: number[]): boolean =>
  member.positionId != null && positionIds.includes(member.positionId);

const isMemberInAssignmentGroup = (member: MemberDto, assignment: EditableAssignment): boolean =>
  isMemberInPositionIds(member, assignment.positionIds);

type PreviewCellsByDay = Array<{
  day: string;
  cells: EditableAssignment[];
}>;

const groupPreviewCellsByDay = (cells: EditableAssignment[]): PreviewCellsByDay => {
  const groups = new Map<string, EditableAssignment[]>();

  cells.forEach((cell) => {
    const dayCells = groups.get(cell.day) ?? [];
    dayCells.push(cell);
    groups.set(cell.day, dayCells);
  });

  return Array.from(groups.entries()).map(([day, dayCells]) => ({ day, cells: dayCells }));
};

const EMPTY_EDITABLE_PREVIEW_WARNING =
  "Нет назначений для применения. Добавьте сотрудника в предпросмотр или постройте preview заново.";

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
    className={`rounded-xl border px-2.5 py-2 ${
      tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-subtle bg-card text-default"
    }`}
  >
    <div className="text-muted text-[11px] leading-none">{label}</div>
    <div className="mt-1 text-base leading-none font-semibold">{value}</div>
  </div>
);

const WarningBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{children}</div>
);

const getUncoveredSlotKey = (slot: ScheduleAutoBuildUncoveredSlotDto, index: number): string =>
  `${slot.date}-${slot.positionConfigId}-${slot.startTime}-${slot.endTime}-${index}`;

const hasPositionRisks = (position: ScheduleAutoBuildPreviewResponse["positions"][number]): boolean =>
  position.warningsCount > 0 || position.unfilledCount > 0 || position.negativeAssignmentsCount > 0;

const MATCH_STATUS_BADGE: Record<ScheduleAutoBuildCellPreviewDto["matchStatus"], { label: string; className: string }> =
  {
    EXACT_INTERVAL_PREFERENCE: {
      label: "Хочет эту смену",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    COVERING_INTERVAL_PREFERENCE: {
      label: "Готов в это время",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    },
    FULL_DAY_POSITIVE: {
      label: "Готов весь день",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    NO_PREFERENCE: {
      label: "Без пожелания",
      className: "border-slate-200 bg-slate-50 text-slate-600",
    },
    PARTIAL_INTERVAL_FALLBACK: {
      label: "Частично вне пожелания",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    SOFT_NEGATIVE_FALLBACK: {
      label: "Предпочитает выходной",
      className: "border-amber-300 bg-amber-100 text-amber-800",
    },
    HARD_NEGATIVE_FALLBACK: {
      label: "Не может работать",
      className: "border-rose-300 bg-rose-100 text-rose-800",
    },
    MANUAL_OVERRIDE: {
      label: "Изменено вручную",
      className: "border-violet-200 bg-violet-50 text-violet-700",
    },
  };

const AssignmentMatchBadge: React.FC<{ cell: ScheduleAutoBuildCellPreviewDto }> = ({ cell }) => {
  const badge = MATCH_STATUS_BADGE[cell.matchStatus] ?? MATCH_STATUS_BADGE.NO_PREFERENCE;

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
  );
};

const ApplySchedulePreferencesDialog: React.FC<ApplySchedulePreferencesDialogProps> = ({
  open,
  scheduleStatus,
  preferenceBuildTemplateId,
  applying,
  autoApplying,
  templates,
  templatesLoading,
  templatesError,
  members,
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
  const [editableAssignments, setEditableAssignments] = React.useState<EditableAssignment[]>([]);
  const [manualWarning, setManualWarning] = React.useState<string | null>(null);

  const memberNames = React.useMemo(() => buildMemberDisplayNameMap(members), [members]);

  React.useEffect(() => {
    if (!preview) {
      setEditableAssignments([]);
      setManualWarning(null);
      return;
    }
    setEditableAssignments(
      preview.positions.flatMap((position) =>
        position.cells
          .filter((cell) => cell.memberId != null && cell.startTime && cell.endTime)
          .map((cell, index) => ({
            ...cell,
            id: `${position.positionConfigId}-${cell.day}-${cell.memberId ?? "none"}-${cell.startTime ?? ""}-${index}`,
            positionConfigId: position.positionConfigId,
            positionId: cell.positionId ?? position.positionIds[0],
            positionIds: position.positionIds ?? [],
          })),
      ),
    );
    setManualWarning(null);
  }, [preview]);

  const isMemberBusy = React.useCallback(
    (memberId: number, day: string, exceptAssignmentId?: string) =>
      editableAssignments.some(
        (assignment) =>
          assignment.id !== exceptAssignmentId && assignment.memberId === memberId && assignment.day === day,
      ),
    [editableAssignments],
  );

  const replaceAssignmentMember = React.useCallback(
    (assignmentId: string, memberIdValue: string) => {
      const memberId = Number(memberIdValue);
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member) return;
      setEditableAssignments((current) =>
        current.map((assignment) =>
          assignment.id === assignmentId && isMemberInAssignmentGroup(member, assignment)
            ? {
                ...assignment,
                memberId,
                positionId: member.positionId ?? assignment.positionId,
                memberName: memberDisplayName(member, memberNames),
                matchStatus: "MANUAL_OVERRIDE",
                reason: "Изменено вручную",
              }
            : assignment,
        ),
      );
      setManualWarning("Предпросмотр изменён вручную. После удаления или замены покрытие может быть неполным.");
    },
    [memberNames, members],
  );

  const deleteAssignment = React.useCallback((assignmentId: string) => {
    setEditableAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
    setManualWarning("Назначение удалено. После применения покрытие может быть неполным.");
  }, []);

  const assignUncoveredSlot = React.useCallback(
    (slot: ScheduleAutoBuildUncoveredSlotDto, memberIdValue: string) => {
      const memberId = Number(memberIdValue);
      const member = members.find((candidate) => candidate.id === memberId);
      if (!member || !isMemberInPositionIds(member, slot.positionIds ?? [])) return;
      setEditableAssignments((current) => [
        ...current,
        {
          id: `manual-${slot.positionConfigId}-${slot.date}-${slot.startTime}-${memberId}-${Date.now()}`,
          positionConfigId: slot.positionConfigId,
          positionId: member.positionId as number,
          positionIds: slot.positionIds ?? [],
          memberId,
          memberName: memberDisplayName(member, memberNames),
          day: slot.date,
          value: `${slot.startTime}–${slot.endTime}`,
          shiftOptionId: null,
          shiftLabel: `${slot.startTime}–${slot.endTime}`,
          startTime: slot.startTime,
          endTime: slot.endTime,
          reason: "Назначено вручную",
          matchStatus: "MANUAL_OVERRIDE",
          warningMessage: null,
          warnings: [],
        },
      ]);
      setManualWarning("Сотрудник назначен на незакрытый слот вручную.");
    },
    [memberNames, members],
  );

  const adjustedAssignments = React.useMemo<AdjustedScheduleAutoBuildAssignment[]>(
    () =>
      editableAssignments
        .filter((assignment) => assignment.memberId != null && assignment.startTime && assignment.endTime)
        .map((assignment) => ({
          memberId: assignment.memberId as number,
          memberName: assignment.memberName,
          positionConfigId: assignment.positionConfigId,
          positionId: assignment.positionId,
          day: assignment.day,
          value: assignment.value,
          shiftOptionId: assignment.shiftOptionId,
          shiftLabel: assignment.shiftLabel,
          startTime: assignment.startTime as string,
          endTime: assignment.endTime as string,
          reason: assignment.reason,
          matchStatus: assignment.matchStatus,
          warningMessage: assignment.warningMessage,
        })),
    [editableAssignments],
  );

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
  const isEditablePreviewEmpty = Boolean(preview) && editableAssignments.length === 0;
  const canApplyAutoBuild =
    Boolean(selectedTemplateId) &&
    Boolean(preview) &&
    previewMatchesSelectedTemplate &&
    !isEditablePreviewEmpty &&
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
                  if (templateId) void onApplyAutoBuild(templateId, adjustedAssignments);
                }}
                disabled={!canApplyAutoBuild}
              >
                {autoApplying ? "Применение…" : "Применить автосборку"}
              </Button>
              <span
                className={`text-xs ${hasPreviewRisks(preview) || isEditablePreviewEmpty ? "text-amber-700" : "text-muted"}`}
              >
                {preview && !previewMatchesSelectedTemplate
                  ? "Предпросмотр построен для другого шаблона. Постройте новый предпросмотр."
                  : isEditablePreviewEmpty
                    ? EMPTY_EDITABLE_PREVIEW_WARNING
                    : getPreviewApplyHint(preview)}
              </span>
            </div>
          </div>
        </section>

        {preview && (
          <section className="border-subtle bg-app rounded-2xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-default text-sm font-semibold">Предпросмотр автосборки</h3>
              <span className="text-muted text-xs">Проверьте изменения перед применением</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <SummaryCounter label="Назначений" value={editableAssignments.length} />
              <SummaryCounter label="Незаполнено" value={preview.unfilledCount} tone="warning" />
              <SummaryCounter label="Предупреждений" value={preview.warningsCount} tone="warning" />
              <SummaryCounter label="Вопреки пожеланиям" value={preview.negativeAssignmentsCount} tone="warning" />
            </div>

            <div className="mt-3 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              <div className="space-y-2">
                {isEditablePreviewEmpty && <WarningBox>{EMPTY_EDITABLE_PREVIEW_WARNING}</WarningBox>}
                {preview.unfilledCount > 0 && (
                  <WarningBox>Не все потребности закрыты. После применения проверьте пустые места вручную.</WarningBox>
                )}
                {manualWarning && <WarningBox>{manualWarning}</WarningBox>}
                {preview.negativeAssignmentsCount > 0 && (
                  <WarningBox>Есть назначения вопреки отрицательным пожеланиям сотрудников.</WarningBox>
                )}
                {preview.totalAssignments === 0 && (
                  <WarningBox>
                    Автосборка не создала ни одного назначения. Проверьте настройки покрытия и варианты смен.
                  </WarningBox>
                )}
              </div>

              {preview.uncoveredSlots.length > 0 && (
                <details
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                  open
                >
                  <summary className="cursor-pointer font-semibold">
                    Не закрытые потребности: {preview.uncoveredSlots.length} слотов
                  </summary>
                  <div className="text-muted mt-1 text-xs">
                    Показано {preview.uncoveredSlots.length} незакрытых слотов
                  </div>
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {preview.uncoveredSlots.map((slot, idx) => {
                      const candidates = members
                        .filter((member) => isMemberInPositionIds(member, slot.positionIds ?? []))
                        .filter((member) => !isMemberBusy(member.id, slot.date));
                      return (
                        <div
                          key={getUncoveredSlotKey(slot, idx)}
                          className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium">{slot.date}</span>
                            {slot.positionName && <span>{slot.positionName}</span>}
                            <span>
                              {slot.startTime}–{slot.endTime}
                            </span>
                            <span className="text-amber-800">
                              не хватает {Math.max(slot.requiredCount - slot.assignedCount, 0)} из {slot.requiredCount}
                            </span>
                          </div>
                          <div className="mt-2">
                            {candidates.length === 0 ? (
                              <div className="text-xs text-amber-800">Нет доступных сотрудников для этого слота</div>
                            ) : (
                              <select
                                className="border-subtle rounded-lg border bg-white px-2 py-1 text-xs"
                                value=""
                                aria-label="Назначить сотрудника"
                                onChange={(event) => assignUncoveredSlot(slot, event.target.value)}
                                disabled={autoApplying}
                              >
                                <option value="">Назначить сотрудника</option>
                                {candidates.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {memberDisplayName(member, memberNames)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              {preview.rejectionHints.length > 0 && (
                <details className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  <summary className="cursor-pointer font-semibold">
                    Не выбраны из-за лимита смен: {preview.rejectionHints.length}
                  </summary>
                  <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pr-1 pl-5">
                    {preview.rejectionHints.map((hint, idx) => (
                      <li key={`${hint.memberId}-${hint.date}-${hint.positionConfigId}-${hint.startTime ?? ""}-${idx}`}>
                        {hint.date}: {hint.memberName ?? `Сотрудник #${hint.memberId}`}
                        {hint.positionName ? `, ${hint.positionName}` : ""}
                        {hint.shiftLabel ??
                          (hint.startTime && hint.endTime ? `, ${hint.startTime}–${hint.endTime}` : "")}
                        {" — "}
                        {hint.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {preview.warnings.length > 0 && (
                <details
                  className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-sm text-amber-800"
                  open
                >
                  <summary className="cursor-pointer font-semibold">Предупреждения: {preview.warnings.length}</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {preview.warnings.map((warning, idx) => (
                      <li key={`top-warning-${idx}`}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="space-y-3">
                {preview.positions.map((position, positionIdx) => {
                  const positionAssignments = editableAssignments.filter(
                    (assignment) => assignment.positionConfigId === position.positionConfigId,
                  );
                  const openByDefault = positionIdx === 0 || hasPositionRisks(position);
                  return (
                    <details
                      key={position.positionConfigId}
                      className="border-subtle rounded-xl border bg-white/40 p-3"
                      open={openByDefault}
                    >
                      <summary className="cursor-pointer text-sm font-semibold">
                        {position.positionName} · назначений: {positionAssignments.length} · незаполнено:{" "}
                        {position.unfilledCount}
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                        <SummaryCounter label="Назначений" value={positionAssignments.length} />
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
                            <li key={`${position.positionConfigId}-warning-${idx}`}>{warning}</li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 space-y-3">
                        {groupPreviewCellsByDay(positionAssignments).map((dayGroup) => (
                          <div
                            key={`${position.positionConfigId}-${dayGroup.day}`}
                            className="rounded-xl bg-white/60 p-3"
                          >
                            <div className="text-default text-xs font-semibold">{dayGroup.day}</div>
                            <div className="mt-2 space-y-2">
                              {dayGroup.cells.map((cell, idx) => (
                                <div
                                  key={`${position.positionConfigId}-${cell.day}-${cell.memberId ?? "none"}-${idx}`}
                                  className={`rounded-lg border px-3 py-2 text-xs ${
                                    cell.matchStatus === "SOFT_NEGATIVE_FALLBACK" ||
                                    cell.matchStatus === "HARD_NEGATIVE_FALLBACK" ||
                                    cell.matchStatus === "PARTIAL_INTERVAL_FALLBACK"
                                      ? "border-amber-200 bg-amber-50/80"
                                      : "border-subtle bg-white"
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-medium">{cell.memberName ?? "Не назначено"}</span>
                                    <span className="text-muted">—</span>
                                    <span>{cell.shiftLabel ?? cell.value ?? "Смена не указана"}</span>
                                    <span className="text-muted">—</span>
                                    <span className="text-muted">{cell.reason ?? "Причина не указана"}</span>
                                    <AssignmentMatchBadge cell={cell} />
                                  </div>
                                  {cell.warningMessage && (
                                    <div className="mt-1 text-amber-700">{cell.warningMessage}</div>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <select
                                      className="border-subtle rounded-lg border bg-white px-2 py-1"
                                      value={cell.memberId ?? ""}
                                      onChange={(event) =>
                                        replaceAssignmentMember((cell as EditableAssignment).id, event.target.value)
                                      }
                                      disabled={autoApplying}
                                    >
                                      {members
                                        .filter((member) => isMemberInPositionIds(member, position.positionIds ?? []))
                                        .filter(
                                          (member) =>
                                            member.id === cell.memberId ||
                                            !isMemberBusy(member.id, cell.day, (cell as EditableAssignment).id),
                                        )
                                        .map((member) => (
                                          <option key={member.id} value={member.id}>
                                            {memberDisplayName(member, memberNames)}
                                          </option>
                                        ))}
                                    </select>
                                    <Button
                                      variant="outline"
                                      onClick={() => deleteAssignment((cell as EditableAssignment).id)}
                                      disabled={autoApplying}
                                    >
                                      Удалить
                                    </Button>
                                  </div>
                                  {cell.warnings.length > 0 && (
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-700">
                                      {cell.warnings.map((warning, warningIdx) => (
                                        <li
                                          key={`${position.positionConfigId}-${cell.day}-${idx}-warning-${warningIdx}`}
                                        >
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
                    </details>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
};

export default ApplySchedulePreferencesDialog;

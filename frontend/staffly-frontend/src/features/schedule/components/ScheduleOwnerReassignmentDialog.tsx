import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import SelectField from "../../../shared/ui/SelectField";
import type { ScheduleOwnerReassignmentOptionDto } from "../api";

function formatOwner(candidate: {
  displayName: string | null;
  role?: string | null;
  positionName?: string | null;
}): string {
  const name = candidate.displayName?.trim() || "Без имени";
  const meta = [candidate.role, candidate.positionName].map((value) => String(value ?? "").trim()).filter(Boolean);

  return meta.length > 0 ? `${name} · ${meta.join(" · ")}` : name;
}

type ScheduleOwnerReassignmentDialogProps = {
  open: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  options: ScheduleOwnerReassignmentOptionDto[];
  selectedOwnerUserIdsByScheduleId: Record<number, number | null>;
  onSelect: (scheduleId: number, ownerUserId: number | null) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function ScheduleOwnerReassignmentDialog({
  open,
  loading,
  saving,
  error,
  options,
  selectedOwnerUserIdsByScheduleId,
  onSelect,
  onClose,
  onSubmit,
}: ScheduleOwnerReassignmentDialogProps) {
  const hasOptions = options.length > 0;
  const hasSchedulesWithoutCandidates = options.some((option) => option.candidates.length === 0);
  const hasMissingSelection = options.some((option) => selectedOwnerUserIdsByScheduleId[option.scheduleId] == null);
  const submitDisabled = loading || saving || !hasOptions || hasSchedulesWithoutCandidates || hasMissingSelection;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Переназначить ответственного"
      description="Сотрудник является ответственным за активные или будущие графики. Перед удалением выберите нового ответственного."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={onSubmit} isLoading={saving} disabled={submitDisabled}>
            Переназначить и продолжить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {loading && <div className="text-muted text-sm">Загрузка графиков для переназначения…</div>}

        {!loading && !hasOptions && !error && (
          <div className="border-subtle bg-surface-muted text-muted rounded-xl border p-3 text-sm">
            Активные или будущие графики для переназначения не найдены.
          </div>
        )}

        {!loading &&
          options.map((option) => {
            const selectedOwnerUserId = selectedOwnerUserIdsByScheduleId[option.scheduleId];
            const currentOwnerName = option.currentOwner ? formatOwner(option.currentOwner) : "не назначен";

            return (
              <div key={option.scheduleId} className="border-subtle space-y-3 rounded-2xl border p-4">
                <div>
                  <div className="text-strong font-medium">{option.scheduleTitle}</div>
                  <div className="text-muted text-sm">
                    {option.startDate} — {option.endDate}
                  </div>
                  <div className="text-muted mt-1 text-xs">Текущий ответственный: {currentOwnerName}</div>
                </div>

                {option.candidates.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Нет доступных кандидатов для переназначения
                  </div>
                ) : (
                  <SelectField
                    label="Новый ответственный"
                    value={selectedOwnerUserId == null ? "" : String(selectedOwnerUserId)}
                    onChange={(event) => {
                      const value = event.target.value;
                      onSelect(option.scheduleId, value ? Number(value) : null);
                    }}
                    disabled={saving}
                  >
                    <option value="" disabled>
                      Выберите ответственного
                    </option>
                    {option.candidates.map((candidate) => (
                      <option
                        key={candidate.userId ?? `member-${candidate.memberId ?? candidate.displayName ?? "unknown"}`}
                        value={candidate.userId ?? ""}
                        disabled={candidate.userId == null}
                      >
                        {formatOwner(candidate)}
                      </option>
                    ))}
                  </SelectField>
                )}
              </div>
            );
          })}

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </div>
    </Modal>
  );
}

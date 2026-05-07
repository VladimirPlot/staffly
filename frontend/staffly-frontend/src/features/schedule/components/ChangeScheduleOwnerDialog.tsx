import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import SelectField from "../../../shared/ui/SelectField";
import type { ScheduleOwnerDto } from "../types";

function formatOwnerCandidate(candidate: ScheduleOwnerDto): string {
  const name = candidate.displayName?.trim() || "Без имени";
  const meta = [candidate.role, candidate.positionName].map((value) => String(value ?? "").trim()).filter(Boolean);

  return meta.length > 0 ? `${name} · ${meta.join(" · ")}` : name;
}

type ChangeScheduleOwnerDialogProps = {
  open: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  candidates: ScheduleOwnerDto[];
  currentOwnerUserId: number | null;
  selectedOwnerUserId: number | null;
  onSelect: (ownerUserId: number | null) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function ChangeScheduleOwnerDialog({
  open,
  loading,
  saving,
  error,
  candidates,
  currentOwnerUserId,
  selectedOwnerUserId,
  onSelect,
  onClose,
  onSubmit,
}: ChangeScheduleOwnerDialogProps) {
  const selectedIsCurrent =
    selectedOwnerUserId != null && currentOwnerUserId != null && selectedOwnerUserId === currentOwnerUserId;
  const submitDisabled = loading || saving || selectedOwnerUserId == null || selectedIsCurrent;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Сменить ответственного"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={onSubmit} isLoading={saving} disabled={submitDisabled}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {loading && <div className="text-muted text-sm">Загрузка кандидатов…</div>}

        {!loading && candidates.length === 0 && !error && (
          <div className="border-subtle bg-surface-muted text-muted rounded-xl border p-3 text-sm">
            Нет доступных кандидатов для смены ответственного.
          </div>
        )}

        {!loading && candidates.length > 0 && (
          <SelectField
            label="Новый ответственный"
            value={selectedOwnerUserId == null ? "" : String(selectedOwnerUserId)}
            onChange={(event) => {
              const value = event.target.value;
              onSelect(value ? Number(value) : null);
            }}
            disabled={saving}
          >
            <option value="" disabled>
              Выберите ответственного
            </option>
            {candidates.map((candidate) => {
              const isCurrent =
                candidate.userId != null && currentOwnerUserId != null && candidate.userId === currentOwnerUserId;
              return (
                <option
                  key={candidate.userId ?? `member-${candidate.memberId ?? candidate.displayName ?? "unknown"}`}
                  value={candidate.userId ?? ""}
                  disabled={candidate.userId == null || isCurrent}
                >
                  {formatOwnerCandidate(candidate)}
                  {isCurrent ? " (текущий)" : ""}
                </option>
              );
            })}
          </SelectField>
        )}

        {selectedIsCurrent && (
          <div className="text-muted text-sm">Выбран текущий ответственный — выберите другого кандидата.</div>
        )}

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </div>
    </Modal>
  );
}

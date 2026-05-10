import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import SelectField from "../../../shared/ui/SelectField";
import type { MemberResponsibilityCandidateDto, MemberResponsibilityHandoffOptionsDto } from "../api";

function formatCandidate(candidate: MemberResponsibilityCandidateDto): string {
  return [candidate.displayName, candidate.role, candidate.positionName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

type MemberResponsibilityHandoffDialogProps = {
  open: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  options: MemberResponsibilityHandoffOptionsDto | null;
  selectedOwnerUserIdsByKey: Record<string, number | null>;
  onSelect: (key: string, ownerUserId: number | null) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function getMemberResponsibilityItemKey(type: string, resourceId: number): string {
  return `${type}:${resourceId}`;
}

export default function MemberResponsibilityHandoffDialog({
  open,
  loading,
  saving,
  error,
  options,
  selectedOwnerUserIdsByKey,
  onSelect,
  onClose,
  onSubmit,
}: MemberResponsibilityHandoffDialogProps) {
  const groups = options?.groups ?? [];
  const items = groups.flatMap((group) => group.items);
  const hasOptions = Boolean(options) && items.length > 0;
  const hasItemsWithoutCandidates = items.some((item) => item.candidates.length === 0);
  const hasMissingSelection = groups.some((group) =>
    group.items.some((item) => selectedOwnerUserIdsByKey[getMemberResponsibilityItemKey(group.type, item.id)] == null),
  );
  const submitDisabled = loading || saving || !hasOptions || hasItemsWithoutCandidates || hasMissingSelection;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Переназначить ответственности"
      description="Сотрудник отвечает за активные объекты. Перед удалением выберите новых ответственных для всех объектов."
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
        {loading && <div className="text-muted text-sm">Загрузка ответственностей для переназначения…</div>}

        {!loading && options && (
          <div className="border-subtle bg-surface-muted rounded-xl border p-3 text-sm">
            Сотрудник: <span className="text-strong font-medium">{options.fullName}</span>
          </div>
        )}

        {!loading && !hasOptions && !error && (
          <div className="border-subtle bg-surface-muted text-muted rounded-xl border p-3 text-sm">
            Активные ответственности для переназначения не найдены.
          </div>
        )}

        {!loading &&
          groups.map((group) => (
            <section key={group.type} className="space-y-3">
              <h3 className="text-strong text-base font-semibold">{group.title}</h3>

              {group.items.map((item) => {
                const itemKey = getMemberResponsibilityItemKey(group.type, item.id);
                const selectedOwnerUserId = selectedOwnerUserIdsByKey[itemKey];

                return (
                  <div key={itemKey} className="border-subtle space-y-3 rounded-2xl border p-4">
                    <div className="space-y-1">
                      <div className="text-strong font-medium">{item.title}</div>
                      {item.subtitle && <div className="text-muted text-sm">{item.subtitle}</div>}
                      {item.period && (
                        <div className="text-muted text-sm">
                          {item.period.startDate} — {item.period.endDate}
                        </div>
                      )}
                    </div>

                    {item.candidates.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Нет доступных кандидатов для переназначения. Добавьте подходящего участника или измените
                        настройки объекта.
                      </div>
                    ) : (
                      <SelectField
                        label="Новый ответственный"
                        value={selectedOwnerUserId == null ? "" : String(selectedOwnerUserId)}
                        onChange={(event) => {
                          const value = event.target.value;
                          onSelect(itemKey, value ? Number(value) : null);
                        }}
                        disabled={saving}
                      >
                        <option value="" disabled>
                          Выберите ответственного
                        </option>
                        {item.candidates.map((candidate) => (
                          <option key={candidate.userId} value={candidate.userId}>
                            {formatCandidate(candidate)}
                          </option>
                        ))}
                      </SelectField>
                    )}
                  </div>
                );
              })}
            </section>
          ))}

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </div>
    </Modal>
  );
}

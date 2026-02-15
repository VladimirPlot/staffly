import Modal from "../../../shared/ui/Modal";
import Button from "../../../shared/ui/Button";
import SelectField from "../../../shared/ui/SelectField";
import type { PositionDto } from "../../dictionaries/api";

type EditMemberPositionModalProps = {
  open: boolean;
  loading: boolean;
  positionsError: string | null;
  options: PositionDto[];
  value: number | null;
  memberDescription?: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onChangeValue: (value: number | null) => void;
};

export default function EditMemberPositionModal({
  open,
  loading,
  positionsError,
  options,
  value,
  memberDescription,
  saving,
  error,
  onClose,
  onSave,
  onChangeValue,
}: EditMemberPositionModalProps) {
  return (
    <Modal
      open={open}
      title="Редактировать должность"
      description={memberDescription}
      onClose={onClose}
      footer={
        open ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={onSave} disabled={saving || loading || value == null} isLoading={saving}>
              Сохранить
            </Button>
          </>
        ) : null
      }
    >
      {loading ? (
        <div className="text-sm text-muted">Загрузка должностей…</div>
      ) : positionsError ? (
        <div className="text-sm text-red-600">{positionsError}</div>
      ) : options.length === 0 ? (
        <div className="text-sm text-muted">Нет доступных активных должностей для этой роли.</div>
      ) : (
        <SelectField
          label="Должность"
          value={value ?? ""}
          onChange={(event) => onChangeValue(event.target.value ? Number(event.target.value) : null)}
        >
          {options.map((position) => (
            <option key={position.id} value={position.id}>
              {position.name}
            </option>
          ))}
        </SelectField>
      )}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </Modal>
  );
}

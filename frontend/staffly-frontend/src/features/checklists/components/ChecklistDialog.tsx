import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import type { PositionDto } from "../../dictionaries/api";
import ChecklistItemsEditor from "./checklistDialog/ChecklistItemsEditor";
import InfoContentField from "./checklistDialog/InfoContentField";
import PositionFields from "./checklistDialog/PositionFields";
import TrackableScheduleFields from "./checklistDialog/TrackableScheduleFields";
import { useChecklistDialogForm } from "./checklistDialog/useChecklistDialogForm";
import type { ChecklistDialogInitial, ChecklistDialogSubmitPayload } from "./checklistDialog/types";

export type { ChecklistDialogInitial, ChecklistDialogSubmitPayload } from "./checklistDialog/types";

type ChecklistDialogProps = {
  open: boolean;
  title: string;
  positions: PositionDto[];
  initialData?: ChecklistDialogInitial;
  submitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: ChecklistDialogSubmitPayload) => void;
};

const ChecklistDialog = ({
  open,
  title,
  positions,
  initialData,
  submitting,
  error,
  onClose,
  onSubmit,
}: ChecklistDialogProps) => {
  const form = useChecklistDialogForm({ open, positions, initialData, onSubmit });
  const effectiveError = error || form.localError;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={form.handleSubmit} disabled={submitting}>
            {submitting ? "Сохраняем…" : "Сохранить"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Название"
          value={form.name}
          onChange={(event) => form.setName(event.target.value)}
          disabled={submitting}
        />

        <PositionFields
          fields={form.positionFields}
          positionOptions={form.positionOptions}
          submitting={submitting}
          onAdd={form.handleAddPosition}
          onRemove={form.handleRemovePosition}
          onChange={form.handlePositionChange}
        />

        {form.isTrackable ? (
          <div className="space-y-3">
            <TrackableScheduleFields
              periodicity={form.periodicity}
              resetHour={form.resetHour}
              resetMinute={form.resetMinute}
              resetDayOfWeek={form.resetDayOfWeek}
              resetDayOfMonth={form.resetDayOfMonth}
              submitting={submitting}
              setPeriodicity={form.setPeriodicity}
              setResetHour={form.setResetHour}
              setResetMinute={form.setResetMinute}
              setResetDayOfWeek={form.setResetDayOfWeek}
              setResetDayOfMonth={form.setResetDayOfMonth}
            />

            <ChecklistItemsEditor
              items={form.items}
              submitting={submitting}
              onAddItem={form.handleAddItem}
              onRemoveItem={form.handleRemoveItem}
              onItemChange={form.handleItemChange}
              onItemPhotoModeChange={form.handleItemPhotoModeChange}
              onExampleFileChange={form.handleExampleFileChange}
              onRemoveExamplePhoto={form.handleRemoveExamplePhoto}
            />
          </div>
        ) : (
          <InfoContentField content={form.content} submitting={submitting} onChange={form.setContent} />
        )}

        {effectiveError && <div className="text-sm text-red-600">{effectiveError}</div>}
      </div>
    </Modal>
  );
};

export default ChecklistDialog;

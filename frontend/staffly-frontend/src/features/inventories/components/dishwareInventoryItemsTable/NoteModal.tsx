import Button from "../../../../shared/ui/Button";
import Modal from "../../../../shared/ui/Modal";
import Textarea from "../../../../shared/ui/Textarea";
import type { DishwareInventoryEditableItem } from "../../dishwareInventoryItems";

type NoteModalProps = {
  item: DishwareInventoryEditableItem | null;
  readOnly: boolean;
  onClose: () => void;
  onChange: (clientId: string, patch: Partial<DishwareInventoryEditableItem>) => void;
};

export default function NoteModal({ item, readOnly, onClose, onChange }: NoteModalProps) {
  return (
    <Modal
      open={Boolean(item)}
      title={item?.name.trim() || "Заметка к позиции"}
      onClose={onClose}
      className="max-w-xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Готово
        </Button>
      }
    >
      {item ? (
        <div>
          <Textarea
            label="Заметка"
            labelClassName="sr-only"
            className="min-h-32 rounded-xl px-3 py-2"
            value={item.note ?? ""}
            maxLength={5000}
            disabled={readOnly}
            rows={5}
            autoFocus={!readOnly}
            placeholder="Например, новая партия, бой, место хранения или комментарий по пересчету."
            onChange={(event) => onChange(item.clientId, { note: event.target.value.slice(0, 5000) })}
          />
          <div className="text-muted mt-1 text-right text-xs">{(item.note ?? "").length}/5000</div>
        </div>
      ) : null}
    </Modal>
  );
}

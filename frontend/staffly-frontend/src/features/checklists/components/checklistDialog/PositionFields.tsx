import { Trash2 } from "lucide-react";

import Button from "../../../../shared/ui/Button";
import DropdownSelect from "../../../../shared/ui/DropdownSelect";
import Icon from "../../../../shared/ui/Icon";
import type { PositionDto } from "../../../dictionaries/api";
import type { PositionField } from "./types";

type PositionFieldsProps = {
  fields: PositionField[];
  positionOptions: PositionDto[];
  submitting: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, value: string) => void;
};

export default function PositionFields({
  fields,
  positionOptions,
  submitting,
  onAdd,
  onRemove,
  onChange,
}: PositionFieldsProps) {
  return (
    <div>
      <div className="text-muted mb-2 text-sm">Должности</div>
      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.id} className="flex items-center gap-3">
            <DropdownSelect
              aria-label="Должность"
              className="flex-1 rounded-2xl p-2 text-base"
              value={field.value}
              onChange={(event) => onChange(field.id, event.target.value)}
              disabled={submitting}
            >
              <option value="">Выберите должность</option>
              {positionOptions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                  {!position.active ? " (неактивна)" : ""}
                </option>
              ))}
            </DropdownSelect>
            <Button
              variant="danger-ghost"
              size="icon"
              onClick={() => onRemove(field.id)}
              disabled={fields.length <= 1 || submitting}
              aria-label="Удалить должность"
            >
              <Icon icon={Trash2} />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" onClick={onAdd} disabled={submitting} className="mt-2 text-sm">
        Добавить должность
      </Button>
    </div>
  );
}

import { Camera, ImageOff, Trash2 } from "lucide-react";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import type { DishwareInventoryDraftItem } from "../utils";
import { computeDishwareItemMetrics, formatInventoryCount, formatInventoryLossAmount } from "../utils";

type DishwareInventoryItemCardProps = {
  item: DishwareInventoryDraftItem;
  index: number;
  disabled?: boolean;
  onChange: (
    localId: string,
    field: "name" | "previousQty" | "currentQty" | "unitPrice" | "note",
    value: string,
  ) => void;
  onRemove: (localId: string) => void;
  onImageSelect: (localId: string, file: File | null) => void;
  onImageDelete: (localId: string) => void;
};

export default function DishwareInventoryItemCard({
  item,
  index,
  disabled = false,
  onChange,
  onRemove,
  onImageSelect,
  onImageDelete,
}: DishwareInventoryItemCardProps) {
  const metrics = computeDishwareItemMetrics(item);
  const displayImageUrl = item.pendingImagePreviewUrl || (!item.removeImage ? item.photoUrl : null);
  const fileInputId = `dishware-image-input-${item.localId}`;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted text-xs">Позиция {index + 1}</div>
          <div className="text-default mt-1 text-sm font-semibold">
            {item.name.trim() || "Новая позиция"}
          </div>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => onRemove(item.localId)}
          disabled={disabled}
          aria-label="Удалить позицию"
          title="Удалить позицию"
        >
          <Icon icon={Trash2} size="sm" />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="border-subtle bg-app relative overflow-hidden rounded-3xl border aspect-square">
            {displayImageUrl ? (
              <img src={displayImageUrl} alt={item.name || "Фото позиции"} className="h-full w-full object-cover" />
            ) : (
              <div className="text-muted flex h-full items-center justify-center text-sm">
                Фото не добавлено
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <input
                id={fileInputId}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                disabled={disabled}
                onChange={(event) => onImageSelect(item.localId, event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={disabled}
                leftIcon={<Icon icon={Camera} size="sm" />}
                onClick={() => document.getElementById(fileInputId)?.click()}
              >
                {displayImageUrl ? "Изменить" : "Добавить"}
              </Button>
            </label>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={disabled || (!displayImageUrl && !item.photoUrl)}
              leftIcon={<Icon icon={ImageOff} size="sm" />}
              onClick={() => onImageDelete(item.localId)}
            >
              Удалить
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Input
            label="Название"
            value={item.name}
            onChange={(event) => onChange(item.localId, "name", event.target.value)}
            placeholder="Например, тарелка суповая"
            disabled={disabled}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Было"
              type="number"
              min="0"
              inputMode="numeric"
              value={item.previousQty}
              onChange={(event) => onChange(item.localId, "previousQty", event.target.value)}
              disabled={disabled}
            />
            <Input
              label="Стало"
              type="number"
              min="0"
              inputMode="numeric"
              value={item.currentQty}
              onChange={(event) => onChange(item.localId, "currentQty", event.target.value)}
              disabled={disabled}
            />
            <Input
              label="Цена за шт"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={item.unitPrice}
              onChange={(event) => onChange(item.localId, "unitPrice", event.target.value)}
              placeholder="Необязательно"
              disabled={disabled}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border-subtle bg-app rounded-2xl border p-3">
              <div className="text-muted text-xs">Разница</div>
              <div className={`mt-1 text-lg font-semibold ${metrics.diff < 0 ? "text-red-600" : "text-default"}`}>
                {metrics.diff > 0 ? `+${formatInventoryCount(metrics.diff)}` : formatInventoryCount(metrics.diff)}
              </div>
            </div>
            <div className="border-subtle bg-app rounded-2xl border p-3">
              <div className="text-muted text-xs">Потери</div>
              <div className="mt-1 text-lg font-semibold text-red-600">
                {formatInventoryCount(metrics.lossQty)}
              </div>
            </div>
            <div className="border-subtle bg-app rounded-2xl border p-3">
              <div className="text-muted text-xs">Сумма потерь</div>
              <div className="mt-1 text-lg font-semibold text-red-600">
                {formatInventoryLossAmount(metrics.lossAmount)}
              </div>
            </div>
          </div>

          <Textarea
            label="Комментарий к позиции"
            value={item.note}
            onChange={(event) => onChange(item.localId, "note", event.target.value)}
            rows={2}
            placeholder="Например, новая партия или бой в зале."
            disabled={disabled}
          />
        </div>
      </div>
    </Card>
  );
}

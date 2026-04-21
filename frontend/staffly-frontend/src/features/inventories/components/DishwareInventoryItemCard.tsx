import { ArrowDownRight, ArrowRightLeft, BadgeRussianRuble, ImagePlus } from "lucide-react";
import { useId, useRef } from "react";

import { cn } from "../../../shared/lib/cn";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import { computeDishwareItemMetrics, formatInventoryCount, formatInventoryLossAmount, formatInventoryLossCount } from "../utils";

type EditableDishwareItemCardItem = {
  clientId: string;
  id?: number;
  name: string;
  photoUrl?: string | null;
  previousQty: number;
  currentQty: number;
  unitPrice?: number | null;
  note?: string | null;
};

type DishwareInventoryItemCardProps = {
  item: EditableDishwareItemCardItem;
  index: number;
  uploading?: boolean;
  onChange: (clientId: string, patch: Partial<EditableDishwareItemCardItem>) => void;
  onRemove: (clientId: string) => void;
  onUploadImage: (itemId: number, file: File) => void;
  onDeleteImage: (itemId: number) => void;
};

export default function DishwareInventoryItemCard({
  item,
  index,
  uploading = false,
  onChange,
  onRemove,
  onUploadImage,
  onDeleteImage,
}: DishwareInventoryItemCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();
  const titleId = useId();
  const hasPhoto = Boolean(item.photoUrl);
  const metrics = computeDishwareItemMetrics({
    previousQty: item.previousQty,
    currentQty: item.currentQty,
    unitPrice: item.unitPrice,
  });

  const deltaDescription =
    metrics.lossQty > 0
      ? `Недостача ${formatInventoryLossCount(metrics.lossQty)} шт`
      : metrics.gainQty > 0
        ? `Излишек ${formatInventoryCount(metrics.gainQty)} шт`
        : "Количество совпадает";
  const metricCardClassName = "rounded-2xl border border-subtle bg-app px-3 py-3";

  return (
    <article aria-labelledby={titleId}>
      <Card className="space-y-4 rounded-[2rem] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-pretty">
              <span className="inline-flex items-center rounded-full border border-subtle bg-[color:var(--staffly-control)] px-2.5 py-1 text-[11px] font-medium text-muted">
                Позиция {index + 1}
              </span>
              <span className="text-xs text-muted">{item.id ? "Можно загрузить фото" : "Фото доступно после сохранения"}</span>
            </div>
            <h4 id={titleId} className="text-base font-semibold text-strong text-balance">
              {item.name.trim() || "Новая позиция"}
            </h4>
            <p className="text-sm text-muted text-pretty">{deltaDescription}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="shrink-0 text-red-600 sm:self-start"
            onClick={() => onRemove(item.clientId)}
            aria-label={`Удалить позицию ${index + 1}`}
          >
            Удалить строку
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-start">
          <div className="space-y-2.5">
            <div className="border-subtle bg-app overflow-hidden rounded-[1.5rem] border">
              <div className="aspect-square">
                {hasPhoto ? (
                  <img src={item.photoUrl!} alt={item.name.trim() || `Фото позиции ${index + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-[color:var(--staffly-control)] text-icon">
                      <Icon icon={ImagePlus} size="md" decorative />
                    </div>
                    <p className="text-sm font-medium text-default">Фото не добавлено</p>
                  </div>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || !item.id) return;
                onUploadImage(item.id, file);
                event.target.value = "";
              }}
            />

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                leftIcon={<Icon icon={ImagePlus} size="sm" decorative />}
                disabled={!item.id || uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {hasPhoto ? "Заменить фото" : "Добавить фото"}
              </Button>

              {hasPhoto && item.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-center px-3 py-2 text-sm text-red-600"
                  disabled={uploading}
                  onClick={() => onDeleteImage(item.id!)}
                >
                  Удалить фото
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
              <Input
                label="Название"
                value={item.name}
                onChange={(event) => onChange(item.clientId, { name: event.target.value })}
                placeholder="Например, тарелка суповая"
              />
              <Input
                label="Цена за шт"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={item.unitPrice ?? ""}
                onChange={(event) =>
                  onChange(item.clientId, {
                    unitPrice: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
                placeholder="Необязательно"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="sm:col-span-1 xl:col-span-1">
                <Input
                  label="Было"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={String(item.previousQty ?? 0)}
                  onChange={(event) => onChange(item.clientId, { previousQty: Number(event.target.value) || 0 })}
                />
              </div>
              <div className="sm:col-span-1 xl:col-span-1">
                <Input
                  label="Стало"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={String(item.currentQty ?? 0)}
                  onChange={(event) => onChange(item.clientId, { currentQty: Number(event.target.value) || 0 })}
                />
              </div>

              <dl className="contents" aria-live="polite">
                <div className={metricCardClassName}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon icon={ArrowRightLeft} size="xs" decorative className="text-icon opacity-70" />
                    <dt className="text-xs font-medium text-muted">Разница</dt>
                  </div>
                  <dd className={cn("text-base font-semibold tabular-nums text-default", metrics.diff < 0 && "text-strong")}>
                    {metrics.diff > 0 ? `+${formatInventoryCount(metrics.diff)}` : formatInventoryCount(metrics.diff)}
                  </dd>
                </div>

                <div className={metricCardClassName}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon icon={ArrowDownRight} size="xs" decorative className="text-icon opacity-70" />
                    <dt className="text-xs font-medium text-muted">Недостача, шт</dt>
                  </div>
                  <dd className="text-base font-semibold tabular-nums text-default">{formatInventoryLossCount(metrics.lossQty)}</dd>
                </div>

                <div className={cn(metricCardClassName, "sm:col-span-2 xl:col-span-1")}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon icon={BadgeRussianRuble} size="xs" decorative className="text-icon opacity-70" />
                    <dt className="text-xs font-medium text-muted">Недостача, ₽</dt>
                  </div>
                  <dd className="text-base font-semibold tabular-nums text-default">
                    {formatInventoryLossAmount(metrics.lossAmount)}
                  </dd>
                </div>
              </dl>
            </div>

            <Textarea
              label="Заметка"
              value={item.note ?? ""}
              onChange={(event) => onChange(item.clientId, { note: event.target.value })}
              rows={3}
              placeholder="Например, новая партия, износ или причина расхождения."
            />
          </div>
        </div>
      </Card>
    </article>
  );
}

import { ChevronDown, ImagePlus } from "lucide-react";
import { useId, useRef, useState } from "react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import {
  computeDishwareItemMetrics,
  formatInventoryCount,
  formatInventoryLossAmount,
  formatInventoryLossCount,
} from "../utils";

type EditableDishwareItemCardItem = {
  clientId: string;
  id?: number;
  name: string;
  photoUrl?: string | null;
  previousQty: number;
  incomingQty: number;
  currentQty: number;
  unitPrice?: number | null;
  note?: string | null;
};

type DishwareInventoryItemCardProps = {
  item: EditableDishwareItemCardItem;
  index: number;
  uploading?: boolean;
  readOnly?: boolean;
  onChange: (clientId: string, patch: Partial<EditableDishwareItemCardItem>) => void;
  onRemove: (clientId: string) => void;
  onUploadImage: (itemId: number, file: File) => void;
  onDeleteImage: (itemId: number) => void;
};

export default function DishwareInventoryItemCard({
  item,
  index,
  uploading = false,
  readOnly = false,
  onChange,
  onRemove,
  onUploadImage,
  onDeleteImage,
}: DishwareInventoryItemCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();
  const titleId = useId();
  const photoHintId = useId();
  const notePanelId = useId();
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const hasPhoto = Boolean(item.photoUrl);
  const noteText = item.note?.trim() ?? "";
  const hasNote = noteText.length > 0;
  const isPhotoBlockedByUnsavedItem = !item.id && !readOnly;
  const photoButtonLabel = !item.id ? "Фото после сохранения" : hasPhoto ? "Заменить фото" : "Добавить фото";
  const noteButtonLabel = isNoteExpanded
    ? "Свернуть"
    : readOnly
      ? "Посмотреть заметку"
      : hasNote
        ? "Изменить заметку"
        : "Добавить заметку";
  const metrics = computeDishwareItemMetrics({
    previousQty: item.previousQty,
    incomingQty: item.incomingQty,
    currentQty: item.currentQty,
    unitPrice: item.unitPrice,
  });
  const primaryMetricItems = [
    {
      label: "Ожидалось",
      value: formatInventoryCount(metrics.expectedQty),
      tone: "default" as const,
    },
    {
      label: "Разница к ожиданию",
      value:
        metrics.diff > 0 ? `+${formatInventoryCount(metrics.diff)}` : formatInventoryLossCount(metrics.diff),
      tone: metrics.diff < 0 ? ("loss" as const) : metrics.diff > 0 ? ("gain" as const) : ("default" as const),
    },
    {
      label: "Недостача, шт",
      value: formatInventoryLossCount(metrics.lossQty),
      tone: metrics.lossQty > 0 ? ("loss" as const) : ("default" as const),
    },
    {
      label: "Излишек, шт",
      value: metrics.gainQty > 0 ? `+${formatInventoryCount(metrics.gainQty)}` : "0",
      tone: metrics.gainQty > 0 ? ("gain" as const) : ("default" as const),
    },
    {
      label: "Недостача, ₽",
      value: formatInventoryLossAmount(metrics.lossAmount),
      tone: metrics.lossAmount > 0 ? ("loss" as const) : ("default" as const),
    },
  ];

  const summaryMetricItems = primaryMetricItems.slice(0, 2);
  const resultMetricItems = primaryMetricItems.slice(2);

  function getToneClass(tone: (typeof primaryMetricItems)[number]["tone"]) {
    if (tone === "loss") return "text-amber-700";
    if (tone === "gain") return "text-emerald-700";
    return "text-default";
  }

  function getMetricCardClass(tone: (typeof primaryMetricItems)[number]["tone"]) {
    if (tone === "loss") {
      return "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20";
    }

    if (tone === "gain") {
      return "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20";
    }

    return "border-subtle bg-[color:var(--staffly-control)]/45";
  }

  return (
    <article aria-labelledby={titleId}>
      <Card className="space-y-3 rounded-[1.75rem] p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <span className="inline-flex items-center rounded-full border border-subtle bg-[color:var(--staffly-control)] px-2.5 py-1 text-[11px] font-medium text-muted">
              Позиция {index + 1}
            </span>
            <h4 id={titleId} className="text-base font-semibold text-strong text-balance">
              {item.name.trim() || "Новая позиция"}
            </h4>
          </div>

          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 text-red-600"
              onClick={() => onRemove(item.clientId)}
              aria-label={`Удалить позицию ${index + 1}`}
            >
              Удалить
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-[132px_minmax(0,1fr)] lg:items-start">
          <div className="space-y-2">
            <div className="border-subtle bg-app overflow-hidden rounded-[1.25rem] border">
              <div className="aspect-square">
                {hasPhoto ? (
                  <img src={item.photoUrl!} alt={item.name.trim() || `Фото позиции ${index + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                    <div className="flex size-9 items-center justify-center rounded-2xl bg-[color:var(--staffly-control)] text-icon">
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
                size="sm"
                className="w-full justify-center"
                leftIcon={<Icon icon={ImagePlus} size="sm" decorative />}
                disabled={readOnly || !item.id || uploading}
                aria-describedby={isPhotoBlockedByUnsavedItem ? photoHintId : undefined}
                onClick={() => fileInputRef.current?.click()}
              >
                {photoButtonLabel}
              </Button>

              {isPhotoBlockedByUnsavedItem ? (
                <p id={photoHintId} className="px-1 text-xs leading-5 text-muted">
                  Сначала сохраните документ, потом можно будет прикрепить фото.
                </p>
              ) : null}

              {hasPhoto && item.id && !readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-sm text-red-600"
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
                labelClassName="mb-0.5 text-xs font-medium"
                className="h-9 rounded-xl px-3"
                value={item.name}
                disabled={readOnly}
                onChange={(event) => onChange(item.clientId, { name: event.target.value })}
                placeholder="Например, тарелка суповая"
              />
              <Input
                label="Цена за шт"
                labelClassName="mb-0.5 text-xs font-medium"
                className="h-9 rounded-xl px-3"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={item.unitPrice ?? ""}
                disabled={readOnly}
                onChange={(event) =>
                  onChange(item.clientId, {
                    unitPrice: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
                placeholder="Необязательно"
              />
            </div>

            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_repeat(2,minmax(0,0.9fr))]">
              <Input
                label="Было"
                labelClassName="mb-0.5 text-xs font-medium"
                className="h-9 rounded-xl px-3"
                type="number"
                min={0}
                inputMode="numeric"
                value={String(item.previousQty ?? 0)}
                disabled={readOnly}
                onChange={(event) => onChange(item.clientId, { previousQty: Number(event.target.value) || 0 })}
              />
              <Input
                label="Докупили"
                labelClassName="mb-0.5 text-xs font-medium"
                className="h-9 rounded-xl px-3"
                type="number"
                min={0}
                inputMode="numeric"
                value={String(item.incomingQty ?? 0)}
                disabled={readOnly}
                onChange={(event) => onChange(item.clientId, { incomingQty: Number(event.target.value) || 0 })}
              />
              <Input
                label="Стало"
                labelClassName="mb-0.5 text-xs font-medium"
                className="h-9 rounded-xl px-3"
                type="number"
                min={0}
                inputMode="numeric"
                value={String(item.currentQty ?? 0)}
                disabled={readOnly}
                onChange={(event) => onChange(item.clientId, { currentQty: Number(event.target.value) || 0 })}
              />

              {summaryMetricItems.map((metric) => (
                <div key={metric.label} className={`rounded-2xl border px-3 py-2 ${getMetricCardClass(metric.tone)}`}>
                  <div className="text-[11px] font-medium text-muted">{metric.label}</div>
                  <div className={`mt-1 text-base font-semibold tabular-nums ${getToneClass(metric.tone)}`}>
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-3" aria-live="polite">
              {resultMetricItems.map((metric) => (
                <div key={metric.label} className={`rounded-2xl border px-3 py-2 ${getMetricCardClass(metric.tone)}`}>
                  <div className="text-[11px] font-medium text-muted">{metric.label}</div>
                  <div className={`mt-1 text-base font-semibold tabular-nums ${getToneClass(metric.tone)}`}>
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/30">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted">Заметка</span>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
                        hasNote
                          ? "bg-[color:var(--staffly-surface)] text-default"
                          : "bg-[color:var(--staffly-control)] text-muted",
                      ].join(" ")}
                    >
                      {hasNote ? "Есть текст" : "Пусто"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {isNoteExpanded
                      ? readOnly
                        ? "Заметка открыта для просмотра."
                        : "Здесь можно коротко указать партию, износ или причину расхождения."
                      : hasNote
                        ? "Заметка сохранена в карточке и свернута, чтобы не занимать место."
                        : "Короткая заметка помогает запомнить партию, износ или причину расхождения."}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2.5 text-xs"
                  rightIcon={
                    <Icon
                      icon={ChevronDown}
                      size="xs"
                      decorative
                      className={`transition-transform ${isNoteExpanded ? "rotate-180" : ""}`}
                    />
                  }
                  aria-expanded={isNoteExpanded}
                  aria-controls={notePanelId}
                  onClick={() => setIsNoteExpanded((value) => !value)}
                >
                  {noteButtonLabel}
                </Button>
              </div>

              {isNoteExpanded ? (
                <div id={notePanelId} className="border-t border-subtle px-3 pb-3 pt-3">
                  <Textarea
                    label="Заметка"
                    labelClassName="sr-only"
                    className="rounded-xl px-3 py-2.5"
                    value={item.note ?? ""}
                    disabled={readOnly}
                    onChange={(event) => onChange(item.clientId, { note: event.target.value })}
                    rows={3}
                    autoFocus={!readOnly}
                    placeholder="Например, новая партия или бой."
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </article>
  );
}

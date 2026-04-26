import { ChevronDown, ImagePlus, StickyNote } from "lucide-react";
import type { CSSProperties } from "react";
import { useId, useRef, useState } from "react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import { cn } from "../../../shared/lib/cn";
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

type MetricTone = "default" | "loss" | "gain";

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

  const resultMetricItems = primaryMetricItems;
  const statusLabel =
    metrics.diff < 0
      ? `${formatInventoryLossCount(metrics.diff)} недостача`
      : metrics.diff > 0
        ? `+${formatInventoryCount(metrics.diff)} излишек`
        : "0 без расхождения";
  const statusValue =
    metrics.diff < 0
      ? formatInventoryLossCount(metrics.diff)
      : metrics.diff > 0
        ? `+${formatInventoryCount(metrics.diff)}`
        : "0";
  const statusCaption = metrics.diff < 0 ? "недостача" : metrics.diff > 0 ? "излишек" : "ровно";
  const statusTone: MetricTone = metrics.diff < 0 ? "loss" : metrics.diff > 0 ? "gain" : "default";

  function getToneClass(tone: MetricTone) {
    if (tone === "gain") return "text-emerald-700 dark:text-emerald-200";
    return "text-default";
  }

  function getToneStyle(tone: MetricTone): CSSProperties | undefined {
    if (tone === "loss") {
      return {
        color: "#dc2626",
        WebkitTextFillColor: "#dc2626",
        opacity: 1,
      };
    }

    if (tone === "gain") {
      return {
        color: "#047857",
        WebkitTextFillColor: "#047857",
        opacity: 1,
      };
    }

    return undefined;
  }

  function getMetricCardClass(tone: MetricTone) {
    return cn(
      "border-subtle bg-[color:var(--staffly-surface)]",
      tone === "loss" && "border-[#fecaca] bg-[#fff7f7] dark:border-red-900/40 dark:bg-red-950/10",
      tone === "gain" && "border-[#a7f3d0] bg-[#f0fdf4] dark:border-emerald-900/40 dark:bg-emerald-950/10",
    );
  }

  function getStatusClass(tone: MetricTone) {
    return cn(
      "border-subtle bg-[color:var(--staffly-surface)] text-default",
      tone === "loss" &&
        "border-red-200 bg-red-50/25 text-red-700 dark:border-red-900/40 dark:bg-red-950/10 dark:text-red-300",
      tone === "gain" &&
        "border-emerald-200 bg-emerald-50/25 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/10 dark:text-emerald-300",
    );
  }

  return (
    <article aria-labelledby={titleId}>
      <Card className="rounded-3xl p-3 sm:p-3.5">
        <div className="grid gap-3 md:grid-cols-[116px_minmax(0,1fr)] lg:grid-cols-[124px_minmax(0,1fr)] lg:items-start">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="border-subtle text-muted inline-flex items-center rounded-full border bg-[color:var(--staffly-control)] px-2 py-0.5 text-[11px] leading-5 font-medium">
                Позиция {index + 1}
              </span>
              <span className="text-muted max-w-[8rem] truncate text-[11px] leading-5 md:hidden">
                {item.name.trim() || "Новая позиция"}
              </span>
            </div>
            <h4 id={titleId} className="sr-only">
              {item.name.trim() || "Новая позиция"}
            </h4>
            <div className="border-subtle bg-app overflow-hidden rounded-2xl border">
              <div className="aspect-square">
                {hasPhoto ? (
                  <img
                    src={item.photoUrl!}
                    alt={item.name.trim() || `Фото позиции ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center">
                    <div className="text-icon flex size-8 items-center justify-center rounded-xl bg-[color:var(--staffly-control)]">
                      <Icon icon={ImagePlus} size="sm" decorative />
                    </div>
                    <p className="text-default text-xs leading-4 font-medium">Фото не добавлено</p>
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

            <div className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full justify-center px-2 text-xs"
                leftIcon={<Icon icon={ImagePlus} size="sm" decorative />}
                disabled={readOnly || !item.id || uploading}
                aria-describedby={isPhotoBlockedByUnsavedItem ? photoHintId : undefined}
                onClick={() => fileInputRef.current?.click()}
              >
                {photoButtonLabel}
              </Button>

              {isPhotoBlockedByUnsavedItem ? (
                <p id={photoHintId} className="text-muted px-1 text-xs leading-4">
                  Сначала сохраните документ, потом можно будет прикрепить фото.
                </p>
              ) : null}

              {hasPhoto && item.id && !readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-center px-2 text-xs text-red-600"
                  disabled={uploading}
                  onClick={() => onDeleteImage(item.id!)}
                >
                  Удалить фото
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(118px,0.45fr)_minmax(132px,0.48fr)_auto] lg:items-end">
              <Input
                label="Название"
                labelClassName="mb-0.5 text-[11px] font-medium"
                className="h-9 rounded-xl px-3 text-sm"
                value={item.name}
                disabled={readOnly}
                onChange={(event) => onChange(item.clientId, { name: event.target.value })}
                placeholder="Например, тарелка суповая"
              />
              <Input
                label="Цена"
                labelClassName="mb-0.5 text-[11px] font-medium"
                className="h-9 rounded-xl px-3 text-sm"
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
                placeholder="0,00"
              />
              <div className="min-w-0">
                <div className="text-muted mb-0.5 text-[11px] font-medium">Итог</div>
                <span
                  className={cn(
                    "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border px-3 tabular-nums",
                    getStatusClass(statusTone),
                  )}
                  title={statusLabel}
                >
                  <span className="text-sm leading-none font-medium">{statusValue}</span>
                  <span className="text-[11px] leading-none opacity-80">{statusCaption}</span>
                </span>
              </div>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 self-end px-3 text-xs text-red-600"
                  onClick={() => onRemove(item.clientId)}
                  aria-label={`Удалить позицию ${index + 1}`}
                >
                  Удалить
                </Button>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Было"
                labelClassName="mb-0.5 text-[11px] font-medium"
                className="h-9 rounded-xl px-3 text-sm"
                type="number"
                min={0}
                inputMode="numeric"
                value={String(item.previousQty ?? 0)}
                disabled={readOnly}
                onChange={(event) => onChange(item.clientId, { previousQty: Number(event.target.value) || 0 })}
              />
              <Input
                label="Докупили"
                labelClassName="mb-0.5 text-[11px] font-medium"
                className="h-9 rounded-xl px-3 text-sm"
                type="number"
                min={0}
                inputMode="numeric"
                value={String(item.incomingQty ?? 0)}
                disabled={readOnly}
                onChange={(event) => onChange(item.clientId, { incomingQty: Number(event.target.value) || 0 })}
              />
              <Input
                label="Стало"
                labelClassName="mb-0.5 text-[11px] font-medium"
                className="h-9 rounded-xl px-3 text-sm"
                type="number"
                min={0}
                inputMode="numeric"
                value={String(item.currentQty ?? 0)}
                disabled={readOnly}
                onChange={(event) => onChange(item.clientId, { currentQty: Number(event.target.value) || 0 })}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
              {resultMetricItems.map((metric) => (
                <div
                  key={metric.label}
                  className={cn("rounded-xl border px-3 py-1.5 lg:min-h-[50px]", getMetricCardClass(metric.tone))}
                >
                  <div className="text-muted text-[11px] leading-4 font-medium">{metric.label}</div>
                  <div
                    className={cn("text-sm leading-5 font-bold tabular-nums", getToneClass(metric.tone))}
                    style={getToneStyle(metric.tone)}
                  >
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-subtle rounded-2xl border bg-[color:var(--staffly-control)]/25">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-muted inline-flex items-center gap-1 text-[11px] font-medium">
                      <Icon icon={StickyNote} size="xs" decorative />
                      Заметка
                    </span>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] leading-none font-medium",
                        hasNote
                          ? "text-default bg-[color:var(--staffly-surface)]"
                          : "text-muted bg-[color:var(--staffly-control)]",
                      ].join(" ")}
                    >
                      {hasNote ? "Есть" : "Без заметки"}
                    </span>
                  </div>
                  {hasNote && !isNoteExpanded ? (
                    <div className="text-muted mt-0.5 max-w-[56ch] truncate text-xs">{noteText}</div>
                  ) : null}
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
                <div id={notePanelId} className="border-subtle border-t px-3 pt-2 pb-3">
                  <Textarea
                    label="Заметка"
                    labelClassName="sr-only"
                    className="rounded-xl px-3 py-2 text-sm"
                    value={item.note ?? ""}
                    disabled={readOnly}
                    onChange={(event) => onChange(item.clientId, { note: event.target.value })}
                    rows={2}
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

import { useLayoutEffect, useRef, useState } from "react";
import type { GridNavigationHandlers } from "../../../../shared/ui/gridNavigation/gridNavigationTypes";
import Button from "../../../../shared/ui/Button";
import Modal from "../../../../shared/ui/Modal";
import Textarea from "../../../../shared/ui/Textarea";
import type { DishwareInventoryEditableItem } from "../../dishwareInventoryItems";
import {
  computeDishwareItemMetrics,
  formatInventoryLossAmount,
  parseDishwareCountInput,
  parseDishwareMoneyInput,
} from "../../utils";
import PhotoCell from "./PhotoCell";

type Props = {
  item: DishwareInventoryEditableItem;
  index: number;
  nextClientId?: string;
  includeSurplus: boolean;
  readOnly: boolean;
  photosLocked: boolean;
  uploading: boolean;
  navigation: Pick<GridNavigationHandlers, "registerCellRef" | "focusCellById">;
  onChange: (clientId: string, patch: Partial<DishwareInventoryEditableItem>) => void;
  onRemove: (clientId: string) => void;
  onUploadImage: (clientId: string, file: File) => void;
  onViewImage: (clientId: string) => void;
  onDeleteImage: (clientId: string) => void;
  onOpenNote: (clientId: string) => void;
};

export default function MobileDishwareItem({
  item,
  index,
  nextClientId,
  includeSurplus,
  readOnly,
  photosLocked,
  uploading,
  navigation,
  onChange,
  onRemove,
  onUploadImage,
  onViewImage,
  onDeleteImage,
  onOpenNote,
}: Props) {
  const [details, setDetails] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const name = useRef<HTMLSpanElement>(null);
  const metrics = computeDishwareItemMetrics(item, includeSurplus);
  useLayoutEffect(() => {
    const node = name.current;
    if (!node) return;
    const fit = () => {
      node.style.fontSize = "14px";
      for (let size = 14; size > 12 && node.scrollHeight > node.clientHeight + 1; size--)
        node.style.fontSize = `${size - 1}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    fit();
    return () => observer.disconnect();
  }, [item.name]);

  const field = (key: "previousQty" | "incomingQty" | "currentQty" | "unitPrice", label: string, large = false) => {
    const parse = key === "unitPrice" ? parseDishwareMoneyInput : parseDishwareCountInput;
    let error: string | null = null;
    try {
      parse(String(item[key] ?? ""));
    } catch (err) {
      error = (err as Error).message;
    }
    return (
      <label className={large ? "block w-[88px] shrink-0" : "text-muted flex min-w-0 items-center gap-1 text-xs"}>
        <span className={large ? "mb-1 block text-center text-xs font-semibold" : "shrink-0"}>{label}</span>
        <input
          aria-label={`${label}, позиция ${index + 1}`}
          ref={navigation.registerCellRef(`${item.clientId}:${key}`)}
          type="text"
          inputMode={key === "unitPrice" ? "decimal" : "numeric"}
          enterKeyHint={key === "currentQty" && nextClientId ? "next" : "done"}
          value={item[key] ?? ""}
          disabled={readOnly}
          aria-invalid={Boolean(error)}
          title={error ?? undefined}
          className={
            large
              ? "border-subtle bg-app text-strong h-12 w-full rounded-xl border px-2 text-center text-xl font-semibold tabular-nums outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]"
              : "border-subtle text-default h-11 w-14 min-w-0 rounded-lg border bg-transparent px-1 text-center text-[16px] tabular-nums outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]"
          }
          onChange={(event) => onChange(item.clientId, { [key]: event.target.value })}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (key === "currentQty" && nextClientId) {
              navigation.focusCellById(`${nextClientId}:currentQty`);
              document.activeElement?.scrollIntoView({ block: "center", inline: "nearest" });
            } else event.currentTarget.blur();
          }}
        />
      </label>
    );
  };
  return (
    <li className="border-subtle bg-surface rounded-2xl border p-3" aria-label={`Позиция ${index + 1}`}>
      <div className="flex items-center gap-2">
        <div className="w-[88px] shrink-0">
          <PhotoCell
            item={item}
            index={index}
            compact
            uploading={uploading}
            readOnly={readOnly || photosLocked}
            photoMenuOpen={false}
            onPhotoMenuOpenChange={() => {}}
            onUploadImage={onUploadImage}
            onViewImage={onViewImage}
            onDeleteImage={onDeleteImage}
          />
        </div>
        <button
          type="button"
          ref={navigation.registerCellRef(`${item.clientId}:name`)}
          onClick={() => setNameOpen(true)}
          aria-label={`Название, позиция ${index + 1}`}
          className="text-default h-[66px] min-w-0 flex-1 rounded-lg px-1 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
        >
          <span
            ref={name}
            className="line-clamp-3 max-h-[60px] overflow-hidden leading-5 [overflow-wrap:anywhere] break-words"
          >
            {item.name || "Название позиции"}
          </span>
        </button>
        {field("currentQty", "Стало", true)}
      </div>
      <div className="mt-2 flex items-center justify-between gap-1">
        {field("previousQty", "Было")}
        {field("incomingQty", "Приход")}
        <button
          type="button"
          className="text-muted min-h-11 shrink-0 rounded-lg px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
          aria-expanded={details}
          onClick={() => setDetails(!details)}
        >
          Детали {details ? "▴" : "▾"}
        </button>
      </div>
      {metrics.inputError && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {metrics.inputError}
        </p>
      )}
      {details && (
        <div className="border-subtle mt-2 space-y-2 border-t pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {field("unitPrice", "Цена")}
            <span className="text-sm">
              {includeSurplus ? "Баланс" : "Потери"}:{" "}
              {metrics.inputError ? "—" : formatInventoryLossAmount(metrics.lossAmount)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly && !item.note}
              onClick={() => onOpenNote(item.clientId)}
            >
              {item.note ? "Заметка" : "Добавить заметку"}
            </Button>
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={() => onRemove(item.clientId)}>
                Удалить позицию
              </Button>
            )}
          </div>
        </div>
      )}
      <Modal
        open={nameOpen}
        title={readOnly ? "Название позиции" : "Изменить название"}
        onClose={() => setNameOpen(false)}
        footer={<Button onClick={() => setNameOpen(false)}>Готово</Button>}
      >
        <Textarea
          label="Название позиции"
          value={item.name}
          maxLength={200}
          disabled={readOnly}
          onChange={(event) => onChange(item.clientId, { name: event.target.value })}
          rows={4}
        />
      </Modal>
    </li>
  );
}

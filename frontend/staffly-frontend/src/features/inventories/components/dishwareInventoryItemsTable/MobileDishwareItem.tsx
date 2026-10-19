import { StickyNote, Trash2 } from "lucide-react";
import Icon from "../../../../shared/ui/Icon";
import { useLayoutEffect, useRef, useState } from "react";
import type { GridNavigationHandlers } from "../../../../shared/ui/gridNavigation/gridNavigationTypes";
import Button from "../../../../shared/ui/Button";
import Modal from "../../../../shared/ui/Modal";
import Textarea from "../../../../shared/ui/Textarea";
import type { DishwareInventoryEditableItem } from "../../dishwareInventoryItems";
import {
  computeDishwareItemMetrics,
  formatInventoryLossAmount,
  formatCompactInventoryMoney,
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
  const [lossOpen, setLossOpen] = useState(false);
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

  const field = (key: "previousQty" | "incomingQty" | "currentQty" | "unitPrice", label: string) => {
    const parse = key === "unitPrice" ? parseDishwareMoneyInput : parseDishwareCountInput;
    let error: string | null = null;
    try {
      parse(String(item[key] ?? ""));
    } catch (err) {
      error = (err as Error).message;
    }
    return (
      <label
        className={
          key === "unitPrice"
            ? "text-muted flex min-w-0 flex-col justify-end gap-0.5 text-[10px] leading-3"
            : "text-muted flex min-w-0 flex-col gap-1 text-xs"
        }
      >
        <span className={key === "currentQty" ? "text-strong text-center font-semibold" : "text-center"}>{label}</span>
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
          className={[
            "border-subtle text-default w-full min-w-0 rounded-lg border px-1 text-center tabular-nums outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
            key === "unitPrice"
              ? "h-8 bg-transparent text-[16px]"
              : key === "currentQty"
                ? "bg-app text-strong h-11 text-lg font-semibold"
                : "h-11 bg-transparent text-[16px]",
          ].join(" ")}
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
      <div className="grid grid-cols-[clamp(88px,25vw,112px)_minmax(0,1fr)] grid-rows-[24px_24px_52px_auto] gap-x-2 gap-y-2">
        <div className="col-start-1 row-span-3 row-start-1 min-h-0">
          <PhotoCell
            item={item}
            index={index}
            compact
            stretch
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
          className="border-subtle bg-app text-default col-start-2 row-span-2 row-start-1 flex min-h-0 min-w-0 items-center rounded-xl border px-2 py-1 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
        >
          <span
            ref={name}
            className="line-clamp-2 max-h-12 w-full overflow-hidden leading-6 [overflow-wrap:anywhere] break-words"
          >
            {item.name || "Название позиции"}
          </span>
        </button>
        <div
          className={[
            "col-start-2 row-start-3 grid min-w-0 items-end gap-1",
            readOnly
              ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px]"
              : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px_36px]",
          ].join(" ")}
        >
          {field("unitPrice", "Цена")}
          <div className="text-muted flex min-w-0 flex-col gap-0.5 text-center text-[10px] leading-3">
            <span>{includeSurplus ? "Баланс" : "Потери"}</span>
            <button
              type="button"
              aria-label={`${includeSurplus ? "Баланс" : "Потери"}, позиция ${index + 1}`}
              title={formatInventoryLossAmount(metrics.lossAmount)}
              onClick={() => setLossOpen(true)}
              className="border-subtle text-default h-8 min-w-0 overflow-hidden rounded-lg border px-1 text-[11px] whitespace-nowrap tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
            >
              <span className="block truncate">
                {metrics.inputError ? "—" : formatCompactInventoryMoney(metrics.lossAmount)}
              </span>
            </button>
          </div>
          <button
            type="button"
            title={item.note ? "Открыть заметку" : "Добавить заметку"}
            aria-label={`Заметка позиции ${index + 1}`}
            disabled={readOnly && !item.note}
            onClick={() => onOpenNote(item.clientId)}
            className={[
              "relative flex h-11 w-9 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] disabled:opacity-40",
              item.note ? "text-default bg-[color:var(--staffly-control-hover)]" : "text-muted",
            ].join(" ")}
          >
            <Icon icon={StickyNote} size="sm" decorative />
            {item.note && (
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-1 h-1.5 w-1.5 rounded-full bg-[var(--staffly-text-strong)]"
              />
            )}
          </button>
          {!readOnly && (
            <button
              type="button"
              title="Удалить позицию"
              aria-label={`Удалить позицию ${index + 1}`}
              onClick={() => onRemove(item.clientId)}
              className="flex h-11 w-9 items-center justify-center rounded-lg text-[color:var(--staffly-loss-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
            >
              <Icon icon={Trash2} size="sm" decorative />
            </button>
          )}
        </div>
        <div className="col-span-2 row-start-4 grid min-w-0 grid-cols-3 gap-2">
          {field("previousQty", "Было")}
          {field("incomingQty", "Приход")}
          {field("currentQty", "Стало")}
        </div>
      </div>
      {metrics.inputError && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {metrics.inputError}
        </p>
      )}
      <Modal
        open={lossOpen}
        title={includeSurplus ? "Баланс по позиции" : "Потери по позиции"}
        onClose={() => setLossOpen(false)}
        footer={<Button onClick={() => setLossOpen(false)}>Закрыть</Button>}
      >
        <p className="text-muted mb-2 text-sm break-words">{item.name || `Позиция ${index + 1}`}</p>
        <p className="text-strong text-lg font-semibold break-words">
          {metrics.inputError
            ? "Исправьте числовые значения для расчёта"
            : formatInventoryLossAmount(metrics.lossAmount)}
        </p>
      </Modal>
      <Modal
        open={nameOpen}
        title={readOnly ? "Название позиции" : "Изменить название"}
        onClose={() => setNameOpen(false)}
        footer={<Button onClick={() => setNameOpen(false)}>Готово</Button>}
      >
        <Textarea
          label="Название позиции"
          value={item.name}
          maxLength={50}
          disabled={readOnly}
          onChange={(event) => onChange(item.clientId, { name: event.target.value })}
          rows={4}
        />
      </Modal>
    </li>
  );
}

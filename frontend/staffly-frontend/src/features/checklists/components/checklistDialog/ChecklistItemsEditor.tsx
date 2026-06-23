import { ImagePlus, Trash2 } from "lucide-react";

import Button from "../../../../shared/ui/Button";
import Icon from "../../../../shared/ui/Icon";
import type { ChecklistItemField } from "./types";

type ChecklistItemsEditorProps = {
  items: ChecklistItemField[];
  submitting: boolean;
  onAddItem: () => void;
  onRemoveItem: (clientId: string) => void;
  onItemChange: (clientId: string, value: string) => void;
  onItemRequiredChange: (clientId: string, value: boolean) => void;
  onExampleFileChange: (clientId: string, file?: File) => void;
  onRemoveExamplePhoto: (clientId: string) => void;
};

export default function ChecklistItemsEditor({
  items,
  submitting,
  onAddItem,
  onRemoveItem,
  onItemChange,
  onItemRequiredChange,
  onExampleFileChange,
  onRemoveExamplePhoto,
}: ChecklistItemsEditorProps) {
  return (
    <div>
      <div className="text-default mb-2 text-sm">Пункты чек-листа</div>
      <div className="space-y-3">
        {items.map((item, index) => {
          const examplePreview = item.examplePreviewUrl || item.examplePhotoUrl || undefined;
          return (
            <div key={item.clientId} className="border-subtle bg-app/60 space-y-3 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted text-sm">Пункт {index + 1}</span>
                <Button
                  variant="danger-ghost"
                  size="icon"
                  onClick={() => onRemoveItem(item.clientId)}
                  disabled={items.length <= 1 || submitting}
                  aria-label="Удалить пункт чек-листа"
                >
                  <Icon icon={Trash2} />
                </Button>
              </div>
              <textarea
                value={item.value}
                onChange={(event) => onItemChange(item.clientId, event.target.value)}
                rows={2}
                disabled={submitting}
                className="border-subtle bg-surface text-default focus:ring-default w-full resize-y rounded-xl border p-3 text-[16px] [overflow-wrap:anywhere] transition outline-none focus:ring-2"
              />
              <label className="bg-surface text-default inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.completionPhotoRequired}
                  onChange={(event) => onItemRequiredChange(item.clientId, event.target.checked)}
                  disabled={submitting}
                  className="h-4 w-4 accent-[var(--staffly-text-strong)]"
                />
                <span>Требовать фото перед закрытием</span>
              </label>
              <div className="border-subtle bg-surface grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {examplePreview ? (
                    <img
                      src={examplePreview}
                      alt={`Эталон пункта ${index + 1}`}
                      className="h-20 w-28 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="border-subtle bg-app text-muted flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed">
                      <Icon icon={ImagePlus} decorative />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-default text-sm font-medium">Эталон для сотрудника</div>
                    <div className="text-muted text-xs">
                      {item.exampleFile
                        ? item.exampleFile.name
                        : examplePreview
                          ? "Фото прикреплено"
                          : "Можно оставить без эталона"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="border-subtle text-default inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-[var(--staffly-control)] px-3 text-sm font-medium shadow-sm transition hover:bg-[var(--staffly-control-hover)]">
                    <Icon icon={ImagePlus} size="sm" decorative />
                    <span>{examplePreview ? "Заменить эталон" : "Добавить эталон"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={submitting}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          onExampleFileChange(item.clientId, file);
                        }
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {examplePreview && (
                    <Button
                      type="button"
                      variant="danger-ghost"
                      onClick={() => onRemoveExamplePhoto(item.clientId)}
                      disabled={submitting}
                      className="h-9 text-sm"
                      aria-label="Удалить пример"
                    >
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Button variant="outline" onClick={onAddItem} disabled={submitting} className="mt-2 text-sm">
        Добавить пункт
      </Button>
    </div>
  );
}

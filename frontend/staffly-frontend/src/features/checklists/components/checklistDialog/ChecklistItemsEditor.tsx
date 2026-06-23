import { ImagePlus, Trash2 } from "lucide-react";

import Button from "../../../../shared/ui/Button";
import DropdownSelect from "../../../../shared/ui/DropdownSelect";
import Icon from "../../../../shared/ui/Icon";
import type { ChecklistPhotoMode } from "../../api";
import type { ChecklistItemField } from "./types";

const PHOTO_MODE_HELP: Record<ChecklistPhotoMode, string> = {
  NONE: "Сотрудник просто отметит пункт готовым, блок фото выполнения ему не покажется.",
  OPTIONAL: "Сотрудник сможет прикрепить фото, но пункт можно закрыть и без него.",
  REQUIRED: "Сотрудник должен прикрепить фото перед закрытием пункта.",
};

type ChecklistItemsEditorProps = {
  items: ChecklistItemField[];
  submitting: boolean;
  onAddItem: () => void;
  onRemoveItem: (clientId: string) => void;
  onItemChange: (clientId: string, value: string) => void;
  onItemPhotoModeChange: (clientId: string, value: ChecklistPhotoMode) => void;
  onExampleFileChange: (clientId: string, file?: File) => void;
  onRemoveExamplePhoto: (clientId: string) => void;
};

export default function ChecklistItemsEditor({
  items,
  submitting,
  onAddItem,
  onRemoveItem,
  onItemChange,
  onItemPhotoModeChange,
  onExampleFileChange,
  onRemoveExamplePhoto,
}: ChecklistItemsEditorProps) {
  return (
    <div>
      <div className="text-default mb-2 text-sm">Пункты чек-листа</div>
      <div className="space-y-3">
        {items.map((item, index) => {
          const examplePreview = item.examplePreviewUrl || item.examplePhotoUrl || undefined;
          const canUseExamplePhoto = item.completionPhotoMode !== "NONE";
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
              <div>
                <div className="text-muted mb-1 text-xs font-medium">Фото выполнения</div>
                <DropdownSelect
                  aria-label="Режим фото выполнения"
                  className="w-full rounded-xl p-2 text-base"
                  value={item.completionPhotoMode}
                  onChange={(event) => onItemPhotoModeChange(item.clientId, event.target.value as ChecklistPhotoMode)}
                  disabled={submitting}
                >
                  <option value="NONE">Без фото</option>
                  <option value="OPTIONAL">Фото по желанию</option>
                  <option value="REQUIRED">Фото обязательно</option>
                </DropdownSelect>
                <div className="text-muted mt-1 text-xs leading-4">{PHOTO_MODE_HELP[item.completionPhotoMode]}</div>
              </div>
              {canUseExamplePhoto && (
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
              )}
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

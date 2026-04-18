import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";

import Modal from "../../shared/ui/Modal";
import Input from "../../shared/ui/Input";
import Textarea from "../../shared/ui/Textarea";
import Button from "../../shared/ui/Button";
import DropdownMenu from "../../shared/ui/DropdownMenu";
import type { AnnouncementRequest } from "./api";
import type { PositionDto } from "../dictionaries/api";
import Icon from "../../shared/ui/Icon";
import SearchBar from "../../shared/ui/SearchBar";
import { cn } from "../../shared/lib/cn";
import { matchesSearchText } from "../../shared/utils/search";

type AnnouncementDialogProps = {
  open: boolean;
  title: string;
  positions: PositionDto[];
  submitting: boolean;
  submitLabel?: string;
  error?: string | null;
  initialData?: { content: string; expiresAt?: string | null; positionIds: number[] };
  onClose: () => void;
  onSubmit: (payload: AnnouncementRequest) => void;
};

const AnnouncementDialog = ({
  open,
  title,
  positions,
  submitting,
  submitLabel = "Сохранить",
  error,
  initialData,
  onClose,
  onSubmit,
}: AnnouncementDialogProps) => {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [content, setContent] = useState(initialData?.content ?? "");
  const [expiresAt, setExpiresAt] = useState(initialData?.expiresAt ?? "");
  const [selectedPositionIds, setSelectedPositionIds] = useState<number[]>([]);
  const [positionQuery, setPositionQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setContent(initialData?.content ?? "");
    setExpiresAt(initialData?.expiresAt ?? "");
    setSelectedPositionIds(initialData?.positionIds ?? []);
    setPositionQuery("");
    setPickerOpen(false);
    setLocalError(null);
  }, [open, initialData?.content, initialData?.expiresAt, initialData?.positionIds]);

  useEffect(() => {
    if (!open) {
      setPositionQuery("");
      setPickerOpen(false);
    }
  }, [open]);

  const positionOptions = useMemo(
    () => [...positions].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [positions],
  );

  const selectedPositions = useMemo(
    () =>
      selectedPositionIds
        .map((positionId) => positionOptions.find((position) => position.id === positionId))
        .filter((position): position is PositionDto => Boolean(position)),
    [positionOptions, selectedPositionIds],
  );

  const availablePositions = useMemo(
    () => positionOptions.filter((position) => !selectedPositionIds.includes(position.id)),
    [positionOptions, selectedPositionIds],
  );

  const filteredPositions = useMemo(() => {
    const query = positionQuery.trim();
    if (!query) return availablePositions;
    return availablePositions.filter((position) =>
      matchesSearchText([position.name, position.active ? "активна" : "неактивна"], query),
    );
  }, [availablePositions, positionQuery]);

  const handleAddPosition = useCallback((positionId: number) => {
    setSelectedPositionIds((prev) => [...prev, positionId]);
    setPositionQuery("");
    setLocalError(null);
  }, []);

  const handleRemovePosition = useCallback((positionId: number) => {
    setSelectedPositionIds((prev) => prev.filter((id) => id !== positionId));
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      setLocalError("Добавьте текст объявления");
      return;
    }
    if (selectedPositionIds.length === 0) {
      setLocalError("Добавьте хотя бы одну должность");
      return;
    }
    setLocalError(null);
    onSubmit({
      content: trimmed,
      expiresAt: expiresAt?.trim() ? expiresAt.trim() : null,
      positionIds: selectedPositionIds,
    });
  }, [content, expiresAt, onSubmit, selectedPositionIds]);

  const effectiveError = error || localError;
  const triggerLabel = useMemo(() => {
    if (selectedPositions.length === 0) {
      return "Выберите должности";
    }

    if (selectedPositions.length === 1) {
      return selectedPositions[0].name;
    }

    return `${selectedPositions.length} должности выбрано`;
  }, [selectedPositions]);

  const chipBase =
    "group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border " +
    "border-[var(--staffly-border)] bg-[var(--staffly-control)] px-2.5 py-1 text-xs " +
    "font-medium leading-none text-[var(--staffly-text)] shadow-none transition-colors " +
    "hover:bg-[var(--staffly-control-hover)]";

  const chipRemoveBase =
    "inline-flex size-5 shrink-0 items-center justify-center rounded-md text-[var(--staffly-text-muted)] " +
    "transition-colors hover:bg-[var(--staffly-surface)] hover:text-[var(--staffly-text-strong)] " +
    "group-hover:text-[var(--staffly-text-strong)] " +
    "focus:outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Сохраняем…" : submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-2 text-sm text-muted">Должности</div>
          <div className="space-y-2">
            <DropdownMenu
              disabled={submitting || availablePositions.length === 0}
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              matchTriggerWidth
              alignClassName="left-0"
              menuClassName="w-[min(30rem,calc(100vw-1rem))]"
              mobileSheetTitle="Должности"
              triggerWrapperClassName="block"
              trigger={(triggerProps) => (
                <button
                  type="button"
                  className="border-subtle bg-surface focus:ring-default flex h-9 w-full items-center justify-between rounded-xl border px-3 text-left text-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-app disabled:text-muted"
                  {...triggerProps}
                >
                  <span className="min-w-0 truncate font-medium text-default">{triggerLabel}</span>
                  <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-muted" />
                </button>
              )}
            >
              {({ close }) => (
                <div className="space-y-2 p-1">
                  <SearchBar
                    label="Поиск должности"
                    value={positionQuery}
                    onValueChange={setPositionQuery}
                    placeholder="Найти должность"
                    disabled={submitting}
                  />

                  <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
                    {filteredPositions.length > 0 ? (
                      filteredPositions.map((position) => (
                        <button
                          key={position.id}
                          type="button"
                          className="text-default hover:bg-app focus:bg-app flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition focus:outline-none"
                          onClick={() => {
                            handleAddPosition(position.id);
                            if (filteredPositions.length <= 1) close();
                          }}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="truncate font-medium">
                              {position.name}
                              {!position.active ? " (неактивна)" : ""}
                            </div>
                          </div>
                          <div className="rounded-full border border-subtle bg-surface p-1 text-muted">
                            <span className="sr-only">Добавить {position.name}</span>
                            <Icon icon={Plus} size="xs" decorative />
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl px-3 py-5 text-center text-sm text-muted">
                        Ничего не найдено
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DropdownMenu>

            {selectedPositions.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedPositions.map((position) => (
                  <div
                    key={position.id}
                    className={cn(chipBase)}
                  >
                    <span className="min-w-0 truncate">
                      {position.name}
                      {!position.active ? " (неактивна)" : ""}
                    </span>
                    <button
                      type="button"
                      aria-label={`Удалить должность ${position.name}`}
                      onClick={() => handleRemovePosition(position.id)}
                      disabled={submitting}
                      className={cn(chipRemoveBase, "disabled:cursor-not-allowed disabled:opacity-50")}
                    >
                      <Icon icon={X} size="xs" decorative />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <Input
          label="Дата окончания (необязательно)"
          type="date"
          min={today}
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          disabled={submitting}
        />

        <Textarea
          label="Объявление"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={6}
          disabled={submitting}
          className="resize-y"
        />

        {effectiveError && <div className="text-sm text-red-600">{effectiveError}</div>}
      </div>
    </Modal>
  );
};

export default AnnouncementDialog;

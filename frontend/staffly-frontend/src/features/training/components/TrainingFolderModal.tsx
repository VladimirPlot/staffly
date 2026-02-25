import { useEffect, useMemo, useState } from "react";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import Button from "../../../shared/ui/Button";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import { createFolder, updateFolder } from "../api/trainingApi";
import type { TrainingFolderDto, TrainingFolderType } from "../api/types";
import { getTrainingErrorMessage } from "../utils/errors";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  restaurantId: number;
  type: TrainingFolderType;
  parentFolder?: TrainingFolderDto | null;
  initialFolder?: TrainingFolderDto | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

type Conflict = {
  folderId: number;
  folderName: string;
  offendingPositionIds: number[];
};

export default function TrainingFolderModal({
  open,
  mode,
  restaurantId,
  type,
  parentFolder = null,
  initialFolder = null,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPositionIds, setSelectedPositionIds] = useState<number[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    if (!open) return;
    void listPositions(restaurantId, { includeInactive: false })
      .then((response) => setPositions(response))
      .catch(() => setPositions([]));
  }, [open, restaurantId]);

  useEffect(() => {
    if (!open) return;
    const baseVisibility =
      mode === "edit"
        ? (initialFolder?.visibilityPositionIds ?? [])
        : parentFolder
          ? parentFolder.visibilityPositionIds
          : [];
    setName(mode === "edit" ? (initialFolder?.name ?? "") : "");
    setDescription(mode === "edit" ? (initialFolder?.description ?? "") : "");
    setSelectedPositionIds(baseVisibility);
    setError(null);
    setConflicts([]);
  }, [open, mode, initialFolder, parentFolder]);

  const parentRestricted = Boolean(parentFolder && parentFolder.visibilityPositionIds.length > 0);
  const allowedPositionIds = useMemo(() => {
    if (!parentRestricted) {
      return new Set(positions.map((position) => position.id));
    }
    return new Set(parentFolder?.visibilityPositionIds ?? []);
  }, [parentRestricted, parentFolder, positions]);

  const availablePositions = useMemo(
    () => positions.filter((position) => allowedPositionIds.has(position.id)),
    [positions, allowedPositionIds]
  );

  const selectedPositions = useMemo(
    () => selectedPositionIds
      .map((id) => positions.find((position) => position.id === id))
      .filter((position): position is PositionDto => Boolean(position)),
    [selectedPositionIds, positions]
  );

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) return;

    setSubmitting(true);
    setError(null);
    setConflicts([]);
    try {
      if (mode === "create") {
        await createFolder(restaurantId, {
          parentId: parentFolder?.id ?? null,
          type,
          name: trimmedName,
          description: trimmedDescription || null,
          visibilityPositionIds: selectedPositionIds,
        });
      } else if (initialFolder) {
        await updateFolder(restaurantId, initialFolder.id, {
          name: trimmedName,
          description: trimmedDescription || null,
          visibilityPositionIds: selectedPositionIds,
        });
      }
      await onSaved();
      onClose();
    } catch (e: any) {
      const rawConflicts = e?.response?.data?.conflicts;
      if (Array.isArray(rawConflicts)) {
        setConflicts(rawConflicts as Conflict[]);
      }
      setError(getTrainingErrorMessage(e, "Не удалось сохранить папку."));
    } finally {
      setSubmitting(false);
    }
  };

  const addPosition = (positionId: number) => {
    setSelectedPositionIds((prev) => (prev.includes(positionId) ? prev : [...prev, positionId]));
  };

  const removePosition = (positionId: number) => {
    setSelectedPositionIds((prev) => prev.filter((id) => id !== positionId));
  };

  const remainingPositions = availablePositions.filter((p) => !selectedPositionIds.includes(p.id));

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Редактировать папку" : "Создать папку"}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Отмена</Button>
          <Button onClick={handleSave} disabled={submitting || !name.trim()}>{mode === "edit" ? "Сохранить" : "Создать"}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input label="Название" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Описание" value={description} onChange={(event) => setDescription(event.target.value)} />

        <div className="space-y-2">
          <div className="text-sm text-muted">Кто видит</div>
          {!parentRestricted && (
            <Button
              variant={selectedPositionIds.length === 0 ? "primary" : "outline"}
              onClick={() => setSelectedPositionIds([])}
              type="button"
            >
              Всем
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            {selectedPositions.map((position) => (
              <button
                key={position.id}
                type="button"
                className="rounded-full border border-subtle px-3 py-1 text-xs"
                onClick={() => removePosition(position.id)}
              >
                {position.name} ×
              </button>
            ))}
          </div>

          <DropdownMenu
            trigger={(triggerProps) => (
              <Button variant="outline" type="button" {...triggerProps}>
                Добавить должность
              </Button>
            )}
            disabled={remainingPositions.length === 0}
            menuClassName="w-72"
          >
            {({ close }) => (
              <div className="max-h-64 overflow-auto">
                {remainingPositions.map((position) => (
                  <button
                    key={position.id}
                    type="button"
                    role="menuitem"
                    className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                    onClick={() => {
                      addPosition(position.id);
                      close();
                    }}
                  >
                    {position.name}
                  </button>
                ))}
              </div>
            )}
          </DropdownMenu>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {conflicts.length > 0 && (
          <div className="space-y-1 text-sm text-red-600">
            {conflicts.map((conflict) => {
              const names = conflict.offendingPositionIds
                .map((id) => positions.find((position) => position.id === id)?.name ?? `#${id}`)
                .join(", ");
              return (
                <div key={conflict.folderId}>
                  Папка: {conflict.folderName} — лишние должности: {names}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

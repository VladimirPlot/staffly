import { useEffect, useMemo, useState } from "react";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import { createFolder, updateFolder } from "../api/trainingApi";
import type { TrainingFolderDto, TrainingFolderType } from "../api/types";
import { getTrainingErrorMessage } from "../utils/errors";
import VisibilityPositionsField from "./VisibilityPositionsField";

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

  const parentVisibilityPositionIds = useMemo(
    () => parentFolder?.visibilityPositionIds ?? [],
    [parentFolder]
  );

  useEffect(() => {
    if (!open || parentVisibilityPositionIds.length === 0) {
      return;
    }

    const allowedPositionIds = new Set(parentVisibilityPositionIds);
    setSelectedPositionIds((prev) => {
      const filtered = prev.filter((id) => allowedPositionIds.has(id));
      return filtered.length > 0 ? filtered : [...allowedPositionIds];
    });
  }, [open, parentVisibilityPositionIds]);

  const positionNameById = useMemo(
    () => new Map(positions.map((position) => [position.id, position.name])),
    [positions]
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

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Редактировать папку" : "Создать папку"}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={submitting || !name.trim()}>
            {mode === "edit" ? "Сохранить" : "Создать"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input label="Название" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Описание" value={description} onChange={(event) => setDescription(event.target.value)} />

        <VisibilityPositionsField
          positions={positions}
          value={selectedPositionIds}
          onChange={setSelectedPositionIds}
          parentVisibilityPositionIds={parentVisibilityPositionIds}
          disabled={submitting}
        />

        {error && <div className="text-sm text-red-600">{error}</div>}
        {conflicts.length > 0 && (
          <div className="space-y-1 text-sm text-red-600">
            {conflicts.map((conflict) => {
              const names = conflict.offendingPositionIds
                .map((id) => positionNameById.get(id) ?? `#${id}`)
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

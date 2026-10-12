import { useEffect, useMemo, useState } from "react";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import { createFolder, updateFolder } from "../api/trainingApi";
import type { TrainingFolderDto, TrainingFolderType } from "../api/types";
import { getTrainingErrorMessage } from "../utils/errors";
import VisibilityPositionsField from "./VisibilityPositionsField";
import { useTrainingEditorGuard } from "../hooks/useTrainingEditorGuard";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

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
  const guard = useTrainingEditorGuard(open, submitting, onClose);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [positionsRetry, setPositionsRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPositionsLoading(true);
    setPositionsError(null);
    void listPositions(restaurantId, { includeInactive: false })
      .then((response) => {
        if (!cancelled) setPositions(response);
      })
      .catch((error) => {
        if (!cancelled) setPositionsError(getTrainingErrorMessage(error, "Не удалось загрузить должности."));
      })
      .finally(() => {
        if (!cancelled) setPositionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId, positionsRetry]);

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

  const parentVisibilityPositionIds = useMemo(() => parentFolder?.visibilityPositionIds ?? [], [parentFolder]);

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
    [positions],
  );

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || submitting || positionsLoading || positionsError) return;

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
    <>
      <Modal
        open={open}
        title={mode === "edit" ? "Редактировать папку" : "Создать папку"}
        onClose={guard.requestClose}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={guard.requestClose} disabled={submitting}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={submitting || positionsLoading || Boolean(positionsError) || !name.trim()}
            >
              {mode === "edit" ? "Сохранить" : "Создать"}
            </Button>
          </div>
        }
      >
        <fieldset disabled={submitting} className="min-w-0 space-y-3" onChangeCapture={guard.markDirty}>
          <Input label="Название" value={name} onChange={(event) => setName(event.target.value)} />
          <Input label="Описание" value={description} onChange={(event) => setDescription(event.target.value)} />

          {positionsLoading ? (
            <LoadingState label="Загружаем должности…" />
          ) : positionsError ? (
            <ErrorState message={positionsError} onRetry={() => setPositionsRetry((value) => value + 1)} />
          ) : (
            <VisibilityPositionsField
              positions={positions}
              value={selectedPositionIds}
              onChange={(value) => {
                if (submitting) return;
                guard.markDirty();
                setSelectedPositionIds(value);
              }}
              parentVisibilityPositionIds={parentVisibilityPositionIds}
              disabled={submitting}
            />
          )}

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
        </fieldset>
      </Modal>
      {guard.discardDialog}
    </>
  );
}

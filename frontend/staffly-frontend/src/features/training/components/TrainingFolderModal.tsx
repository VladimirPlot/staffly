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

import { useAuth } from "../../../shared/providers/AuthProvider";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { getManageableAudienceRoles } from "../utils/certificationRoleScope";
import { trainingRoleLabels, trainingPreparationAccess } from "../utils/folderRole";

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
  const roleFolder = type !== "KNOWLEDGE";
  const { user } = useAuth();
  const access = useTrainingAccess();
  const allowedRoles = useMemo(
    () =>
      getManageableAudienceRoles({
        isCreator: user?.roles?.includes("CREATOR") ?? false,
        isExaminer: access.isTrainingExaminer,
        membershipRole: access.myRole,
      }),
    [user?.roles, access.isTrainingExaminer, access.myRole],
  );
  const [targetRole, setTargetRole] = useState<RestaurantRole | "">("");
  const roleOptions = parentFolder?.targetRole
    ? allowedRoles.filter((role) => role === parentFolder.targetRole)
    : allowedRoles;
  const roleReady = !roleFolder || (!access.loading && targetRole !== "" && roleOptions.includes(targetRole));
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
    if (!open || roleFolder) return;
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
  }, [open, restaurantId, positionsRetry, roleFolder]);

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

  useEffect(() => {
    if (!open || !roleFolder) return;
    setTargetRole((mode === "edit" ? initialFolder?.targetRole : parentFolder?.targetRole) ?? allowedRoles[0] ?? "");
  }, [open, roleFolder, mode, initialFolder, parentFolder, allowedRoles]);

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
    if (!trimmedName || submitting || !roleReady || (!roleFolder && (positionsLoading || positionsError))) return;

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
          ...(roleFolder
            ? { targetRole: targetRole as RestaurantRole }
            : { visibilityPositionIds: selectedPositionIds }),
        });
      } else if (initialFolder) {
        await updateFolder(restaurantId, initialFolder.id, {
          name: trimmedName,
          description: trimmedDescription || null,
          ...(roleFolder
            ? { targetRole: targetRole as RestaurantRole }
            : { visibilityPositionIds: selectedPositionIds }),
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
              disabled={
                submitting ||
                !roleReady ||
                (!roleFolder && (positionsLoading || Boolean(positionsError))) ||
                !name.trim()
              }
            >
              {mode === "edit" ? "Сохранить" : "Создать"}
            </Button>
          </div>
        }
      >
        <fieldset disabled={submitting} className="min-w-0 space-y-3" onChangeCapture={guard.markDirty}>
          <Input label="Название" value={name} onChange={(event) => setName(event.target.value)} />
          <Input label="Описание" value={description} onChange={(event) => setDescription(event.target.value)} />

          {roleFolder ? (
            <div className="space-y-2">
              <label className="text-muted block text-sm" htmlFor="training-folder-role">
                {type === "QUESTION_BANK"
                  ? "Для сотрудников какой роли предназначены вопросы?"
                  : "Для сотрудников какой роли предназначены аттестации?"}
              </label>
              <select
                id="training-folder-role"
                value={targetRole}
                disabled={submitting || access.loading || Boolean(parentFolder?.targetRole)}
                className="border-subtle bg-surface text-default h-11 w-full rounded-2xl border px-3 text-sm"
                onChange={(event) => setTargetRole(event.target.value as RestaurantRole)}
              >
                {!targetRole && <option value="">Выберите роль</option>}
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {trainingRoleLabels[role]}
                  </option>
                ))}
              </select>
              {targetRole && (
                <p className="text-muted text-sm">Доступ к подготовке: {trainingPreparationAccess(targetRole)}.</p>
              )}
              <p className="text-muted text-xs">
                Сотрудники выбранной роли не могут просматривать вопросы и ответы или редактировать содержимое.
                Специализация EXAMINER и роль CREATOR дают полный доступ в Тренинге независимо от основной роли.
              </p>
              {parentFolder?.targetRole && (
                <p className="text-muted text-xs">Роль наследуется от родительской папки.</p>
              )}
              {access.loading && <LoadingState label="Проверяем права…" />}
            </div>
          ) : positionsLoading ? (
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

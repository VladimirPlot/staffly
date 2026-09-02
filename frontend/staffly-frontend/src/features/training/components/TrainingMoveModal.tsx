import { useEffect, useMemo, useState } from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Modal from "../../../shared/ui/Modal";
import type { TrainingFolderDto, TrainingFolderType } from "../api/types";
import { getTrainingFolderPathLabel, trainingDescendantIds } from "../trainingFolderDnd";
import type { TrainingMoveTarget } from "../trainingFolderObjects";

export default function TrainingMoveModal({
  target,
  type,
  folders,
  currentFolderId,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  target: TrainingMoveTarget | null;
  type: TrainingFolderType;
  folders: TrainingFolderDto[];
  currentFolderId: number | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (folderId: number | null) => void;
}) {
  const [folderId, setFolderId] = useState("");

  useEffect(() => {
    if (!target) return;
    setFolderId(currentFolderId == null ? "" : String(currentFolderId));
  }, [currentFolderId, target]);

  const blocked = useMemo(
    () => (target?.kind === "folder" ? trainingDescendantIds(target.id, folders) : new Set<number>()),
    [folders, target],
  );
  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const options = folders.filter(
    (folder) =>
      folder.type === type &&
      folder.active &&
      !blocked.has(folder.id) &&
      (type !== "CERTIFICATION" || folder.manageable),
  );
  const allowRoot =
    target?.kind === "folder" || target?.kind === "knowledgeItem" || target?.kind === "certificationExam";

  return (
    <Modal
      open={Boolean(target)}
      title="Переместить"
      description={target?.title}
      onClose={onClose}
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button isLoading={submitting} onClick={() => onSubmit(folderId ? Number(folderId) : null)}>
            Переместить
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <DropdownSelect label="Куда" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
          {allowRoot ? <option value="">Корень</option> : null}
          {options.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {getTrainingFolderPathLabel(folder, folderMap)}
            </option>
          ))}
        </DropdownSelect>
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>
    </Modal>
  );
}

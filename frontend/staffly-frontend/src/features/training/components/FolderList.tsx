import Card from "../../../shared/ui/Card";
import type { TrainingFolderDto } from "../api/types";
import FolderRow from "./FolderRow";

type Props = {
  folders: TrainingFolderDto[];
  canManage: boolean;
  actionLoadingId: number | null;
  positionNameById: Map<number, string>;
  onOpen: (folderId: number) => void;
  onEdit: (folder: TrainingFolderDto) => void;
  onHide: (folderId: number) => void;
  onRestore: (folderId: number) => void;
  onDelete: (folderId: number) => void;
};

export default function FolderList({
  folders,
  canManage,
  actionLoadingId,
  positionNameById,
  onOpen,
  onEdit,
  onHide,
  onRestore,
  onDelete,
}: Props) {
  return (
    <Card className="space-y-3">
      {folders.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          canManage={canManage}
          isBusy={actionLoadingId === folder.id}
          positionNameById={positionNameById}
          onOpen={onOpen}
          onEdit={onEdit}
          onHide={onHide}
          onRestore={onRestore}
          onDelete={onDelete}
        />
      ))}
    </Card>
  );
}

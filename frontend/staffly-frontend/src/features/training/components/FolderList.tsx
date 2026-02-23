import Card from "../../../shared/ui/Card";
import type { TrainingFolderDto } from "../api/types";
import FolderRow from "./FolderRow";

type Props = {
  folders: TrainingFolderDto[];
  canManage: boolean;
  actionLoadingId: number | null;
  onSelect: (folder: TrainingFolderDto) => void;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
};

export default function FolderList(props: Props) {
  const { folders, canManage, actionLoadingId, onSelect, onHide, onRestore } = props;

  return (
    <Card className="space-y-3">
      {folders.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          canManage={canManage}
          isBusy={actionLoadingId === folder.id}
          onSelect={onSelect}
          onHide={onHide}
          onRestore={onRestore}
        />
      ))}
    </Card>
  );
}

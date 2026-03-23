import FolderList from "../../components/FolderList";
import type { TrainingFolderDto } from "../../api/types";

type Props = {
  folders: TrainingFolderDto[];
  canManage: boolean;
  actionLoadingId: number | null;
  positionNameById: Map<number, string>;
  onOpen: (id: number) => void;
  onEdit: (folder: TrainingFolderDto) => void;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
};

export default function KnowledgeFoldersSection(props: Props) {
  if (props.folders.length === 0) return null;

  return (
    <FolderList
      folders={props.folders}
      canManage={props.canManage}
      actionLoadingId={props.actionLoadingId}
      positionNameById={props.positionNameById}
      onOpen={props.onOpen}
      onEdit={props.onEdit}
      onHide={props.onHide}
      onRestore={props.onRestore}
      onDelete={props.onDelete}
    />
  );
}

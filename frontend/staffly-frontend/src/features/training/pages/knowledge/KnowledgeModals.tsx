import ExamEditorModal from "../../components/ExamEditorModal";
import KnowledgeItemModal from "../../components/KnowledgeItemModal";
import TrainingFolderModal from "../../components/TrainingFolderModal";
import type { TrainingExamDto, TrainingFolderDto, TrainingKnowledgeItemDto } from "../../api/types";

type Props = {
  restaurantId: number | undefined;
  currentFolderId: number | null;
  folderMap: Map<number, TrainingFolderDto>;
  currentFolder: TrainingFolderDto | null;
  folderModalOpen: boolean;
  editingFolder: TrainingFolderDto | null;
  onCloseFolderModal: () => void;
  onSavedFolder: () => Promise<void>;
  examModalOpen: boolean;
  editingExam: TrainingExamDto | null;
  onCloseExamModal: () => void;
  onSavedExam: () => Promise<void>;
  knowledgeModalOpen: boolean;
  knowledgeModalMode: "create" | "edit";
  editingItem: TrainingKnowledgeItemDto | null;
  onCloseKnowledgeModal: () => void;
  onSavedKnowledge: () => Promise<void>;
};

export default function KnowledgeModals({ restaurantId, ...props }: Props) {
  if (!restaurantId) return null;

  return (
    <>
      <TrainingFolderModal
        open={props.folderModalOpen}
        mode={props.editingFolder ? "edit" : "create"}
        restaurantId={restaurantId}
        type="KNOWLEDGE"
        parentFolder={
          props.editingFolder
            ? props.editingFolder.parentId
              ? props.folderMap.get(props.editingFolder.parentId) ?? null
              : null
            : props.currentFolder
        }
        initialFolder={props.editingFolder}
        onClose={props.onCloseFolderModal}
        onSaved={props.onSavedFolder}
      />

      <ExamEditorModal
        open={props.examModalOpen}
        restaurantId={restaurantId}
        mode="PRACTICE"
        exam={props.editingExam}
        knowledgeFolderId={props.currentFolderId}
        onClose={props.onCloseExamModal}
        onSaved={props.onSavedExam}
      />

      <KnowledgeItemModal
        open={props.knowledgeModalOpen}
        mode={props.knowledgeModalMode}
        item={props.editingItem ?? undefined}
        restaurantId={restaurantId}
        folderId={props.currentFolderId}
        onClose={props.onCloseKnowledgeModal}
        onSaved={props.onSavedKnowledge}
      />
    </>
  );
}

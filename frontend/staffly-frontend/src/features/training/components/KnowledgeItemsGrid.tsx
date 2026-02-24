import type { TrainingKnowledgeItemDto } from "../api/types";
import KnowledgeItemCard from "./KnowledgeItemCard";

type ItemAction = "hide" | "restore" | "delete";

type Props = {
  items: TrainingKnowledgeItemDto[];
  canManage: boolean;
  actionLoadingId: number | null;
  actionLoadingType: ItemAction | null;
  onEdit: (item: TrainingKnowledgeItemDto) => void;
  onHide: (itemId: number) => void;
  onRestore: (itemId: number) => void;
  onDelete: (itemId: number) => void;
};

export default function KnowledgeItemsGrid({
  items,
  canManage,
  actionLoadingId,
  actionLoadingType,
  onEdit,
  onHide,
  onRestore,
  onDelete,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <KnowledgeItemCard
          key={item.id}
          item={item}
          canManage={canManage}
          busyAction={actionLoadingId === item.id ? actionLoadingType : null}
          onEdit={onEdit}
          onHide={onHide}
          onRestore={onRestore}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

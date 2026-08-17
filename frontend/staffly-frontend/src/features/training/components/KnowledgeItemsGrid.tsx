import type { TrainingKnowledgeItemDto } from "../api/types";
import KnowledgeItemCard from "./KnowledgeItemCard";

type Props = {
  items: TrainingKnowledgeItemDto[];
  canManage: boolean;
};

export default function KnowledgeItemsGrid({ items, canManage }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <KnowledgeItemCard key={item.id} item={item} canManage={canManage} />
      ))}
    </div>
  );
}

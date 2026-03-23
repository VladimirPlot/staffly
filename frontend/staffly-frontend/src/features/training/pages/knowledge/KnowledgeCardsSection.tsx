import Card from "../../../../shared/ui/Card";
import ErrorState from "../../components/ErrorState";
import KnowledgeItemsGrid from "../../components/KnowledgeItemsGrid";
import LoadingState from "../../components/LoadingState";
import type { TrainingKnowledgeItemDto } from "../../api/types";

type Props = {
  itemsLoading: boolean;
  itemsError: string | null;
  items: TrainingKnowledgeItemDto[];
  canManage: boolean;
  actionLoadingId: number | null;
  actionLoadingType: "hide" | "restore" | "delete" | null;
  onRetry: () => void;
  onEdit: (item: TrainingKnowledgeItemDto) => void;
  onHide: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
};

export default function KnowledgeCardsSection(props: Props) {
  if (!props.itemsLoading && !props.itemsError && props.items.length === 0) return null;

  return (
    <Card className="space-y-3">
      <h3 className="text-lg font-semibold">Карточки</h3>
      {props.itemsLoading && <LoadingState label="Загрузка карточек…" />}
      {props.itemsError && <ErrorState message={props.itemsError} onRetry={props.onRetry} />}
      {!props.itemsLoading && !props.itemsError && props.items.length > 0 && (
        <KnowledgeItemsGrid
          items={props.items}
          canManage={props.canManage}
          actionLoadingId={props.actionLoadingId}
          actionLoadingType={props.actionLoadingType}
          onEdit={props.onEdit}
          onHide={props.onHide}
          onRestore={props.onRestore}
          onDelete={props.onDelete}
        />
      )}
    </Card>
  );
}

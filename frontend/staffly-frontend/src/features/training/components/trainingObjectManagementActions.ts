import { Edit3, MoveRight, Trash2 } from "lucide-react";

import type { TrainingObjectAction } from "./TrainingObjectActionsMenu";

type BuildTrainingObjectManagementActionsOptions = {
  archiveActionKey: string;
  actionLoading: string | null;
  onEdit: () => void;
  onMove: () => void;
  onArchive: () => void;
};

export function trainingObjectArchiveActionKey(kind: string, id: number) {
  return `archive-${kind}-${id}`;
}

export function buildTrainingObjectManagementActions({
  archiveActionKey,
  actionLoading,
  onEdit,
  onMove,
  onArchive,
}: BuildTrainingObjectManagementActionsOptions): {
  edit: TrainingObjectAction;
  move: TrainingObjectAction;
  archive: TrainingObjectAction;
} {
  const isArchiving = actionLoading === archiveActionKey;

  return {
    edit: { label: "Изменить", icon: Edit3, onSelect: onEdit },
    move: { label: "Переместить", icon: MoveRight, onSelect: onMove },
    archive: {
      label: isArchiving ? "Перемещаем в корзину..." : "В корзину",
      icon: Trash2,
      tone: "danger",
      disabled: isArchiving,
      onSelect: onArchive,
    },
  };
}

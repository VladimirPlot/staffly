import type { ChecklistDialogInitial } from "../components/checklistDialog/types";

export function restorePendingExamplePhotos(
  items: ChecklistDialogInitial["items"],
  remainingFiles: Array<{ index: number; file: File }>,
  remainingDeletes: ReadonlySet<number>,
): ChecklistDialogInitial["items"] {
  return items?.map((item, index) => ({
    ...item,
    exampleFile: remainingFiles.find((entry) => entry.index === index)?.file,
    removeExamplePhoto: item.id != null && remainingDeletes.has(item.id),
  }));
}

import { useCallback, useMemo, useState } from "react";

import { compressImageFile } from "../../../shared/lib/compressImageFile";
import {
  createChecklist,
  deleteChecklistItemExamplePhoto,
  updateChecklist,
  uploadChecklistItemExamplePhoto,
  type ChecklistDto,
  type ChecklistKind,
} from "../api";
import type { ChecklistTab } from "../types";
import type { ChecklistDialogInitial, ChecklistDialogSubmitPayload } from "../components/ChecklistDialog";

function buildDialogInitialFromChecklist(checklist: ChecklistDto): ChecklistDialogInitial {
  return {
    kind: checklist.kind,
    name: checklist.name,
    content: checklist.content ?? "",
    positionIds: checklist.positions.map((position) => position.id),
    periodicity: checklist.periodicity,
    resetTime: checklist.resetTime ?? undefined,
    resetDayOfWeek: checklist.resetDayOfWeek ?? undefined,
    resetDayOfMonth: checklist.resetDayOfMonth ?? undefined,
    items: checklist.items.map((item) => ({
      id: item.id,
      text: item.text,
      completionPhotoRequired: item.completionPhotoRequired,
      examplePhotoUrl: item.examplePhotoUrl,
    })),
  };
}

type UseChecklistDialogControllerParams = {
  restaurantId: number;
  activeKind: ChecklistKind;
  activeTab: ChecklistTab;
  reloadChecklists: () => Promise<void>;
};

export function useChecklistDialogController({
  restaurantId,
  activeKind,
  activeTab,
  reloadChecklists,
}: UseChecklistDialogControllerParams) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogInitial, setDialogInitial] = useState<ChecklistDialogInitial | undefined>(undefined);
  const [editing, setEditing] = useState<ChecklistDto | null>(null);

  const openCreateDialog = useCallback(() => {
    setEditing(null);
    setDialogError(null);
    setDialogInitial({
      kind: activeKind,
      name: "",
      content: "",
      positionIds: [],
      periodicity: activeKind === "TRACKABLE" ? "DAILY" : undefined,
      items: [{ text: "", completionPhotoRequired: false }],
    });
    setDialogOpen(true);
  }, [activeKind]);

  const openEditDialog = useCallback((checklist: ChecklistDto) => {
    setEditing(checklist);
    setDialogError(null);
    setDialogInitial(buildDialogInitialFromChecklist(checklist));
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    if (dialogSubmitting) return;
    setDialogOpen(false);
    setEditing(null);
    setDialogError(null);
  }, [dialogSubmitting]);

  const handleSubmitDialog = useCallback(
    async (payload: ChecklistDialogSubmitPayload) => {
      setDialogSubmitting(true);
      setDialogError(null);

      let savedAfterUpsert: ChecklistDto | null = null;
      try {
        const { exampleFiles = [], examplePhotoDeletes = [], ...checklistPayload } = payload;
        let saved = editing
          ? await updateChecklist(restaurantId, editing.id, checklistPayload)
          : await createChecklist(restaurantId, checklistPayload);
        savedAfterUpsert = saved;

        for (const itemId of examplePhotoDeletes) {
          saved = await deleteChecklistItemExamplePhoto(restaurantId, saved.id, itemId);
          savedAfterUpsert = saved;
        }

        for (const entry of exampleFiles) {
          const targetItem = saved.items[entry.index];
          if (!targetItem) continue;
          const compressed = await compressImageFile(entry.file);
          saved = await uploadChecklistItemExamplePhoto(restaurantId, saved.id, targetItem.id, compressed);
          savedAfterUpsert = saved;
        }

        setDialogOpen(false);
        setEditing(null);
        await reloadChecklists();
      } catch (e: any) {
        console.error("Failed to save checklist", e);
        if (savedAfterUpsert) {
          setEditing(savedAfterUpsert);
          setDialogInitial(buildDialogInitialFromChecklist(savedAfterUpsert));
          await reloadChecklists();
          setDialogError(
            e?.friendlyMessage || "Чек-лист сохранён, но не удалось загрузить часть фото. Повторите сохранение.",
          );
        } else {
          setDialogError(e?.friendlyMessage || "Не удалось сохранить чек-лист");
        }
      } finally {
        setDialogSubmitting(false);
      }
    },
    [editing, reloadChecklists, restaurantId],
  );

  const dialogKind = editing?.kind ?? activeKind;
  const createDialogTitle = useMemo(
    () =>
      editing
        ? dialogKind === "INFO"
          ? "Редактирование скрипта"
          : "Редактирование чек-листа"
        : activeTab === "scripts"
          ? "Новый скрипт"
          : "Новый чек-лист",
    [activeTab, dialogKind, editing],
  );

  return {
    dialogOpen,
    dialogSubmitting,
    dialogError,
    dialogInitial,
    createDialogTitle,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    handleSubmitDialog,
  };
}

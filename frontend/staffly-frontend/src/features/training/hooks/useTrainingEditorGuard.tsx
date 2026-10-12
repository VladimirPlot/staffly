import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";

/** All editor close paths share the same discard and in-flight rules. */
export function useTrainingEditorGuard(open: boolean, busy: boolean, onClose: () => void) {
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  useEffect(() => {
    setDirty(false);
    setDiscardOpen(false);
  }, [open]);
  useEffect(() => {
    if (!open || (!dirty && !busy)) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open, dirty, busy]);
  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  }, [busy, dirty, onClose]);
  return {
    markDirty: () => setDirty(true),
    markSaved: () => setDirty(false),
    requestClose,
    discardDialog: (
      <ConfirmDialog
        open={open && discardOpen}
        title="Отменить изменения?"
        description="Изменения не сохранены. Если закрыть окно, их придётся внести заново."
        cancelText="Продолжить редактирование"
        confirmText="Закрыть без сохранения"
        confirming={busy}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          if (!busy) {
            setDirty(false);
            setDiscardOpen(false);
            onClose();
          }
        }}
      />
    ),
  };
}

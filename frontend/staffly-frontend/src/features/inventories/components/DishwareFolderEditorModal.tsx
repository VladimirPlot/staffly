import { useEffect, useState } from "react";

import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import Textarea from "../../../shared/ui/Textarea";
import type { FolderModalState } from "../dishwareInventoriesTypes";

export default function DishwareFolderEditorModal({
  state,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  state: FolderModalState | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; description: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!state) return;
    setName(state.mode === "edit" ? state.folder.name : "");
    setDescription(state.mode === "edit" ? (state.folder.description ?? "") : "");
  }, [state]);

  return (
    <Modal
      open={Boolean(state)}
      title={state?.mode === "edit" ? "Редактировать папку" : "Новая папка"}
      onClose={onClose}
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button
            disabled={!name.trim()}
            isLoading={submitting}
            onClick={() => onSubmit({ name: name.trim(), description: description.trim() || null })}
          >
            {state?.mode === "edit" ? "Сохранить" : "Создать"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Название" value={name} maxLength={150} onChange={(event) => setName(event.target.value)} />
        <Textarea
          label="Описание"
          value={description}
          maxLength={5000}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
        />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>
    </Modal>
  );
}

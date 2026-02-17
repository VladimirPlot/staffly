import { useCallback, useEffect, useState } from "react";

import Modal from "../../../shared/ui/Modal";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import Button from "../../../shared/ui/Button";
import type { ContactRequest } from "../api";

type ContactDialogProps = {
  open: boolean;
  title: string;
  initialData?: Partial<ContactRequest>;
  submitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: ContactRequest) => void;
};

const ContactDialog = ({
  open,
  title,
  initialData,
  submitting,
  error,
  onClose,
  onSubmit,
}: ContactDialogProps) => {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialData?.name ?? "");
    setDescription(initialData?.description ?? "");
    setPhone(initialData?.phone ?? "");
    setLocalError(null);
  }, [open, initialData?.name, initialData?.description, initialData?.phone]);

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      setLocalError("Введите название контакта");
      return;
    }
    if (!trimmedPhone) {
      setLocalError("Укажите номер телефона");
      return;
    }
    setLocalError(null);
    onSubmit({
      name: trimmedName,
      description: description.trim() || null,
      phone: trimmedPhone,
    });
  }, [name, description, phone, onSubmit]);

  const effectiveError = error || localError;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Сохраняем…" : "Сохранить"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Название контакта" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
        <Textarea
          label="Описание (необязательно)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          disabled={submitting}
        />
        <Input
          label="Номер телефона"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={submitting}
          placeholder="Например, +7 (999) 000-00-00"
        />
        {effectiveError && <div className="text-sm text-red-600">{effectiveError}</div>}
      </div>
    </Modal>
  );
};

export default ContactDialog;

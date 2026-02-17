import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import ContentText from "../../../shared/ui/ContentText";
import Icon from "../../../shared/ui/Icon";
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
  type ContactDto,
  type ContactRequest,
} from "../api";
import ContactDialog from "./ContactDialog";

type ContactsManagerProps = {
  restaurantId: number;
};

const ContactsManager = ({ restaurantId }: ContactsManagerProps) => {
  const [contacts, setContacts] = useState<ContactDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContactDto | null>(null);

  const [menuFor, setMenuFor] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ContactDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listContacts(restaurantId);
      setContacts(data);
    } catch (e) {
      console.error("Failed to load contacts", e);
      setError("Не удалось загрузить контакты");
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (menuFor == null) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest?.("[data-contact-menu]") && !target.closest?.("[data-contact-trigger]")) {
        setMenuFor(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuFor]);

  const openCreateDialog = useCallback(() => {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((contact: ContactDto) => {
    setEditing(contact);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    if (dialogSubmitting) return;
    setDialogOpen(false);
    setEditing(null);
    setDialogError(null);
  }, [dialogSubmitting]);

  const handleSave = useCallback(
    async (payload: ContactRequest) => {
      setDialogSubmitting(true);
      setDialogError(null);
      try {
        if (editing) {
          await updateContact(restaurantId, editing.id, payload);
        } else {
          await createContact(restaurantId, payload);
        }
        setDialogOpen(false);
        setEditing(null);
        await loadContacts();
      } catch (e: any) {
        console.error("Failed to save contact", e);
        const message = e?.friendlyMessage || "Не удалось сохранить контакт";
        setDialogError(message);
      } finally {
        setDialogSubmitting(false);
      }
    },
    [editing, restaurantId, loadContacts]
  );

  const toggleMenu = useCallback((id: number) => {
    setMenuFor((prev) => (prev === id ? null : id));
  }, []);

  const askDelete = useCallback((contact: ContactDto) => {
    setDeleteTarget(contact);
    setMenuFor(null);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteContact(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await loadContacts();
    } catch (e) {
      console.error("Failed to delete contact", e);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, restaurantId, loadContacts]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Контакты ресторана</h3>
          <p className="text-sm text-muted">Добавляйте важные номера и заметки.</p>
        </div>
        <Button onClick={openCreateDialog}>Добавить контакт</Button>
      </div>

      {loading ? (
        <Card className="text-sm text-muted">Загружаем контакты…</Card>
      ) : error ? (
        <Card className="text-sm text-red-600">{error}</Card>
      ) : contacts.length === 0 ? (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Контактов пока нет</div>
              <div className="text-sm text-muted">Создайте первый контакт, чтобы сотрудники могли его увидеть.</div>
            </div>
            <Button variant="outline" onClick={openCreateDialog}>
              Добавить
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <Card key={contact.id} className="relative" data-contact-card>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <ContentText className="text-lg font-semibold">{contact.name}</ContentText>
                  <div className="text-sm text-default">
                    Телефон: {" "}
                    <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                  {contact.description && (
                    <ContentText className="text-sm text-default">{contact.description}</ContentText>
                  )}
                </div>

                <div className="relative" data-contact-menu>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleMenu(contact.id)}
                    data-contact-trigger
                    aria-label="Открыть меню контакта"
                    leftIcon={<Icon icon={Pencil} size="sm" decorative />}
                  >
                  </Button>
                  {menuFor === contact.id && (
                    <div className="absolute right-0 z-10 mt-2 w-48 rounded-2xl border border-subtle bg-surface p-2 shadow-[var(--staffly-shadow)] space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-center text-center text-sm"
                        onClick={() => {
                          openEditDialog(contact);
                          setMenuFor(null);
                        }}
                      >
                        Изменить контакт
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full justify-center text-center text-sm text-red-600"
                        onClick={() => askDelete(contact)}
                      >
                        Удалить контакт
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ContactDialog
        open={dialogOpen}
        title={editing ? "Изменить контакт" : "Добавить контакт"}
        initialData={editing ?? undefined}
        submitting={dialogSubmitting}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить контакт"
        description="Вы уверены, что хотите удалить этот контакт?"
        confirming={deleting}
        confirmText={deleting ? "Удаляем…" : "Удалить"}
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
      />
    </div>
  );
};

export default ContactsManager;

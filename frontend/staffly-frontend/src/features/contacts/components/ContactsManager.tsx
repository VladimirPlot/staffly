import React from "react";

import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
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

const ContactsManager: React.FC<ContactsManagerProps> = ({ restaurantId }) => {
  const [contacts, setContacts] = React.useState<ContactDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogSubmitting, setDialogSubmitting] = React.useState(false);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<ContactDto | null>(null);

  const [menuFor, setMenuFor] = React.useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<ContactDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const loadContacts = React.useCallback(async () => {
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

  React.useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  React.useEffect(() => {
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

  const openCreateDialog = React.useCallback(() => {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = React.useCallback((contact: ContactDto) => {
    setEditing(contact);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    if (dialogSubmitting) return;
    setDialogOpen(false);
    setEditing(null);
    setDialogError(null);
  }, [dialogSubmitting]);

  const handleSave = React.useCallback(
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
        const message = e?.response?.data?.message || "Не удалось сохранить контакт";
        setDialogError(message);
      } finally {
        setDialogSubmitting(false);
      }
    },
    [editing, restaurantId, loadContacts]
  );

  const toggleMenu = React.useCallback((id: number) => {
    setMenuFor((prev) => (prev === id ? null : id));
  }, []);

  const askDelete = React.useCallback((contact: ContactDto) => {
    setDeleteTarget(contact);
    setMenuFor(null);
  }, []);

  const closeDeleteDialog = React.useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = React.useCallback(async () => {
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
          <p className="text-sm text-zinc-600">Добавляйте важные номера и заметки.</p>
        </div>
        <Button onClick={openCreateDialog}>Добавить контакт</Button>
      </div>

      {loading ? (
        <Card>Загружаем контакты…</Card>
      ) : error ? (
        <Card className="text-red-600">{error}</Card>
      ) : contacts.length === 0 ? (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Контактов пока нет</div>
              <div className="text-sm text-zinc-600">Создайте первый контакт, чтобы сотрудники могли его увидеть.</div>
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
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{contact.name}</div>
                  <div className="text-sm text-zinc-700">
                    Телефон: {" "}
                    <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                  {contact.description && (
                    <div className="whitespace-pre-wrap text-sm text-zinc-700">{contact.description}</div>
                  )}
                </div>

                <div className="relative" data-contact-menu>
                  <Button
                    variant="ghost"
                    className="text-sm"
                    onClick={() => toggleMenu(contact.id)}
                    data-contact-trigger
                  >
                    ✏️
                  </Button>
                  {menuFor === contact.id && (
                    <div className="absolute right-0 z-10 mt-2 w-48 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm"
                        onClick={() => {
                          openEditDialog(contact);
                          setMenuFor(null);
                        }}
                      >
                        Изменить контакт
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm text-red-600"
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
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
        confirmLabel={deleting ? "Удаляем…" : "Удалить"}
        cancelLabel="Отмена"
        title="Удалить контакт"
        description="Вы уверены, что хотите удалить этот контакт?"
      />
    </div>
  );
};

export default ContactsManager;

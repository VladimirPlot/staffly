import React from "react";
import PersonalNav from "../components/PersonalNav";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import ContentText from "../../../shared/ui/ContentText";
import type { PersonalNote } from "../api";
import { createNote, deleteNote, listNotes, updateNote } from "../api";

export default function NotesPage() {
  const [notes, setNotes] = React.useState<PersonalNote[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<PersonalNote | null>(null);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await listNotes();
        setNotes(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateNote(editing.id, { title, content });
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      } else {
        const created = await createNote({ title, content });
        setNotes((prev) => [created, ...prev]);
      }
      setEditing(null);
      setTitle("");
      setContent("");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (note: PersonalNote) => {
    setEditing(note);
    setTitle(note.title ?? "");
    setContent(note.content ?? "");
  };

  const onDelete = async (note: PersonalNote) => {
    if (!window.confirm("Удалить заметку?")) return;
    await deleteNote(note.id);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
  };

  return (
    <div className="space-y-4">
      <PersonalNav>
        <div className="text-lg font-semibold">Заметки</div>
      </PersonalNav>

      <div className="rounded-2xl bg-surface p-4 shadow-[var(--staffly-shadow)]">
        <div className="mb-2 text-base font-semibold">{editing ? "Редактирование" : "Новая заметка"}</div>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <Input label="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            label="Текст"
            value={content}
            placeholder="Введите текст заметки"
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setTitle("");
                  setContent("");
                }}
              >
                Отменить
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? "Сохраняем..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-surface p-4 shadow-[var(--staffly-shadow)]">
        <div className="mb-3 text-base font-semibold">Мои заметки</div>
        {loading ? (
          <div className="text-sm text-muted">Загружаем...</div>
        ) : notes.length === 0 ? (
          <div className="text-sm text-muted">Здесь появятся ваши личные заметки.</div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-2xl border border-subtle p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <ContentText className="font-semibold">{note.title || "Без названия"}</ContentText>
                    {note.content && <ContentText className="text-default">{note.content}</ContentText>}
                    <div className="text-xs text-muted">Обновлено: {new Date(note.updatedAt).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(note)}>
                      Редактировать
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(note)}>
                      Удалить
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React from "react";
import PersonalNav from "../components/PersonalNav";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import { PersonalNote, createNote, deleteNote, listNotes, updateNote } from "../api";

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

      <div className="rounded-lg bg-white p-4 shadow-sm">
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

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-3 text-base font-semibold">Мои заметки</div>
        {loading ? (
          <div className="text-sm text-zinc-600">Загружаем...</div>
        ) : notes.length === 0 ? (
          <div className="text-sm text-zinc-600">Здесь появятся ваши личные заметки.</div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{note.title || "Без названия"}</div>
                    {note.content && <div className="whitespace-pre-line text-zinc-700">{note.content}</div>}
                    <div className="text-xs text-zinc-500">Обновлено: {new Date(note.updatedAt).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button className="text-blue-600 hover:underline" onClick={() => onEdit(note)}>
                      редактировать
                    </button>
                    <button className="text-red-500 hover:underline" onClick={() => onDelete(note)}>
                      удалить
                    </button>
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
